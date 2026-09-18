from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.http import HttpResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import (
    AccessPoint, AccessPointAttribute, AttributeDefinition,
    AttributeVerification, Facility, FacilityAttribute, Image,
    Place, PlaceCategory, User, VerificationStatus,
)
from .permissions import CanVerifySubmissions, IsOwnerOrReadOnly
from .serializers import (
    AccessPointAttributeSerializer, AccessPointSerializer,
    AttributeDefinitionSerializer, FacilityAttributeSerializer,
    FacilitySerializer, ImageMetaSerializer, ImageUploadSerializer,
    PlaceCategorySerializer, PlaceDetailSerializer, PlaceListSerializer,
    RegisterSerializer, UserSerializer,
)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(TokenObtainPairView):
    """POST {"username": .., "password": ..} -> {"access": .., "refresh": ..}"""
    permission_classes = [permissions.AllowAny]


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


# ---------------------------------------------------------------------------
# Places
# ---------------------------------------------------------------------------

class PlaceCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PlaceCategory.objects.all()
    serializer_class = PlaceCategorySerializer
    permission_classes = [permissions.AllowAny]


class PlaceViewSet(viewsets.ModelViewSet):
    queryset = Place.objects.select_related("category").all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["category", "city"]

    def get_serializer_class(self):
        return PlaceDetailSerializer if self.action in (
            "retrieve", "create", "update", "partial_update"
        ) else PlaceListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        near = self.request.query_params.get("near")   # "lat,lng"
        radius_km = self.request.query_params.get("radius", "5")
        if near:
            try:
                lat, lng = (float(x) for x in near.split(","))
                point = Point(lng, lat, srid=4326)
                qs = qs.filter(primary_location__distance_lte=(point, D(km=float(radius_km))))
            except (ValueError, TypeError):
                pass
        return qs

    @action(detail=True, methods=["get"])
    def score(self, request, pk=None):
        place = self.get_object()
        access_points = place.access_points.all()
        total = access_points.count()
        accessible = access_points.filter(is_accessible=True).count()
        return Response({
            "overall_accessibility_score": place.overall_accessibility_score,
            "access_points_total": total,
            "access_points_accessible": accessible,
        })


class NearbyPlacesView(APIView):
    """
    GET /api/places/nearby/?lat=X&lng=Y&radius=50
    Returns places within `radius` metres of the given point.
    Used before submission to detect duplicate buildings so contributors
    can add facilities to an existing place instead of creating a duplicate.
    radius defaults to 50 m (same campus block).
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            lat = float(request.query_params["lat"])
            lng = float(request.query_params["lng"])
        except (KeyError, ValueError, TypeError):
            return Response(
                {"detail": "lat and lng query parameters are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        radius_m = float(request.query_params.get("radius", 50))
        point = Point(lng, lat, srid=4326)
        places = Place.objects.select_related("category").filter(
            primary_location__distance_lte=(point, D(m=radius_m))
        )
        return Response(PlaceListSerializer(places, many=True).data)


# ---------------------------------------------------------------------------
# Access Points
# ---------------------------------------------------------------------------

class AccessPointViewSet(viewsets.ModelViewSet):
    serializer_class = AccessPointSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = AccessPoint.objects.all()
        place_id = self.kwargs.get("place_pk")
        if place_id:
            qs = qs.filter(place_id=place_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(place_id=self.kwargs["place_pk"])


class AccessPointAttributeViewSet(viewsets.ModelViewSet):
    serializer_class = AccessPointAttributeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return AccessPointAttribute.objects.filter(
            access_point_id=self.kwargs["access_point_pk"]
        )

    def perform_create(self, serializer):
        serializer.save(access_point_id=self.kwargs["access_point_pk"])

    @action(detail=True, methods=["post"], permission_classes=[CanVerifySubmissions])
    def verify(self, request, pk=None, **kwargs):
        return _verify_attribute(request, AccessPointAttribute, "access_point", pk)


# ---------------------------------------------------------------------------
# Facilities
# ---------------------------------------------------------------------------

class FacilityViewSet(viewsets.ModelViewSet):
    serializer_class = FacilitySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = Facility.objects.all()
        place_id = self.kwargs.get("place_pk")
        if place_id:
            qs = qs.filter(place_id=place_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(place_id=self.kwargs["place_pk"])


class FacilityAttributeViewSet(viewsets.ModelViewSet):
    serializer_class = FacilityAttributeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return FacilityAttribute.objects.filter(facility_id=self.kwargs["facility_pk"])

    def perform_create(self, serializer):
        serializer.save(facility_id=self.kwargs["facility_pk"])

    @action(detail=True, methods=["post"], permission_classes=[CanVerifySubmissions])
    def verify(self, request, pk=None, **kwargs):
        return _verify_attribute(request, FacilityAttribute, "facility", pk)


def _verify_attribute(request, model_cls, table_name, pk):
    """
    Shared confirm/dispute/reject logic for both access-point and facility
    attributes. Body: {"action": "confirm" | "dispute" | "reject", "comment": ""}
    """
    action_value = request.data.get("action")
    if action_value not in ("confirm", "dispute", "reject"):
        return Response({"detail": "action must be confirm, dispute, or reject."},
                         status=status.HTTP_400_BAD_REQUEST)

    attribute = model_cls.objects.get(pk=pk)

    # Guard 1: a submitter can't verify their own submission - that would let
    # a single low-trust account rubber-stamp its own data.
    if attribute.submitted_by_id == request.user.id:
        return Response(
            {"detail": "You cannot verify your own submission."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Guard 2: a user can only weigh in once per attribute value - otherwise
    # one person could confirm repeatedly to force the verification threshold.
    already_acted = AttributeVerification.objects.filter(
        attribute_row_id=attribute.pk,
        attribute_table=table_name,
        verified_by=request.user,
    ).exists()
    if already_acted:
        return Response(
            {"detail": "You have already verified this submission."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    AttributeVerification.objects.create(
        attribute_row_id=attribute.pk,
        attribute_table=table_name,
        verified_by=request.user,
        action=action_value,
        comment=request.data.get("comment", ""),
    )

    if action_value == "confirm":
        attribute.verified_count += 1
        attribute.last_verified_at = timezone.now()
        threshold = 2  # mirrors RAMP_CONFIG["VERIFICATION_THRESHOLD"]
        if attribute.verified_count >= threshold:
            attribute.verification_status = VerificationStatus.VERIFIED
    elif action_value == "dispute":
        attribute.verification_status = VerificationStatus.DISPUTED
    elif action_value == "reject":
        attribute.verification_status = VerificationStatus.REJECTED

    attribute.save()
    serializer_cls = (
        AccessPointAttributeSerializer if table_name == "access_point" else FacilityAttributeSerializer
    )
    return Response(serializer_cls(attribute).data)


# ---------------------------------------------------------------------------
# Attribute definitions (read-only lookup for building submission forms)
# ---------------------------------------------------------------------------

class AttributeDefinitionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AttributeDefinition.objects.all()
    serializer_class = AttributeDefinitionSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["applies_to", "facility_type"]


# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------

class ImageViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["entity_type", "entity_id"]

    def get_queryset(self):
        return Image.objects.exclude(verification_status="removed")

    def get_serializer_class(self):
        return ImageUploadSerializer if self.action == "create" else ImageMetaSerializer

    def create(self, request, *args, **kwargs):
        entity_type = request.data.get("entity_type")
        entity_id = request.data.get("entity_id")
        caps = {"place": 5, "access_point": 3, "facility": 3}
        cap = caps.get(entity_type, 3)
        existing = Image.objects.filter(
            entity_type=entity_type, entity_id=entity_id
        ).exclude(verification_status="removed").count()
        if existing >= cap:
            return Response(
                {"detail": f"Image cap reached ({cap} max for {entity_type})."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        # soft-delete: preserve audit trail rather than hard-deleting the row
        image = self.get_object()
        image.verification_status = "removed"
        image.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ImageFileView(APIView):
    """Streams the full-resolution binary."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        image = Image.objects.get(pk=pk)
        return HttpResponse(bytes(image.image_data), content_type=image.content_type)


class ImageThumbView(APIView):
    """Streams the pre-generated thumbnail."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        image = Image.objects.get(pk=pk)
        data = bytes(image.thumbnail_data or image.image_data)
        return HttpResponse(data, content_type=image.content_type)


# ---------------------------------------------------------------------------
# Admin views (IsAdminUser — requires is_staff=True)
# ---------------------------------------------------------------------------

from .models import (
    AccessibilityProfile, FacilityType, PlaceCategory,
    SystemConfig, AttributeVerification, VenueOwnerProfile,
)
from .serializers import (
    AdminUserSerializer, AdminVenueOwnerProfileSerializer,
    AdminPlaceSerializer, AdminImageSerializer, AdminSystemConfigSerializer,
    AdminAccessibilityProfileSerializer, AdminPlaceCategorySerializer,
    AdminFacilityTypeSerializer, AdminAttributeDefinitionSerializer,
    AdminAttributeVerificationSerializer,
)


class AdminStatsView(APIView):
    """GET /api/admin/stats/ – dashboard counters."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from django.utils import timezone as tz
        from datetime import timedelta
        recent_cutoff = tz.now() - timedelta(days=7)
        return Response({
            "users_total": User.objects.count(),
            "users_recent": User.objects.filter(date_joined__gte=recent_cutoff).count(),
            "places_total": Place.objects.count(),
            "venues_pending": VenueOwnerProfile.objects.filter(approval_status="pending").count(),
            "images_pending": Image.objects.filter(verification_status="pending").count(),
            "images_flagged": Image.objects.filter(verification_status="flagged").count(),
            "attributes_pending": (
                AccessPointAttribute.objects.filter(verification_status="pending").count() +
                FacilityAttribute.objects.filter(verification_status="pending").count()
            ),
        })


class AdminUserViewSet(viewsets.ModelViewSet):
    """Full CRUD on users for admins."""
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["user_type", "is_active", "is_staff"]

    def get_queryset(self):
        qs = User.objects.all().order_by("-date_joined")
        q = self.request.query_params.get("q")
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q))
        return qs


class AdminVenueOwnerViewSet(viewsets.ModelViewSet):
    """Approve / reject venue owner profiles."""
    serializer_class = AdminVenueOwnerProfileSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["approval_status"]

    def get_queryset(self):
        return VenueOwnerProfile.objects.select_related("user").order_by("-id")

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        profile = self.get_object()
        profile.approval_status = "approved"
        profile.reviewed_by = request.user
        from django.utils import timezone as tz
        profile.reviewed_at = tz.now()
        profile.save()
        return Response(self.get_serializer(profile).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        profile = self.get_object()
        profile.approval_status = "rejected"
        profile.reviewed_by = request.user
        from django.utils import timezone as tz
        profile.reviewed_at = tz.now()
        profile.save()
        return Response(self.get_serializer(profile).data)


class AdminPlaceViewSet(viewsets.ModelViewSet):
    """Full CRUD on places for admins."""
    serializer_class = AdminPlaceSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["category", "city"]

    def get_queryset(self):
        qs = Place.objects.select_related("category", "added_by").order_by("-created_at")
        q = self.request.query_params.get("q")
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(name__icontains=q) | Q(city__icontains=q))
        return qs


class AdminPlaceCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = AdminPlaceCategorySerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = PlaceCategory.objects.all().order_by("name")


class AdminFacilityTypeViewSet(viewsets.ModelViewSet):
    serializer_class = AdminFacilityTypeSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = FacilityType.objects.all().order_by("name")


class AdminAccessibilityProfileViewSet(viewsets.ModelViewSet):
    serializer_class = AdminAccessibilityProfileSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = AccessibilityProfile.objects.all().order_by("label")


class AdminAttributeDefinitionViewSet(viewsets.ModelViewSet):
    serializer_class = AdminAttributeDefinitionSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["applies_to", "facility_type"]
    queryset = AttributeDefinition.objects.select_related("facility_type").order_by("name")


class AdminAttributeVerificationViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only audit log of attribute verifications."""
    serializer_class = AdminAttributeVerificationSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["attribute_table", "action"]
    queryset = AttributeVerification.objects.select_related("verified_by").order_by("-created_at")


class AdminImageViewSet(viewsets.ModelViewSet):
    """Image moderation: list, update status, delete."""
    serializer_class = AdminImageSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["entity_type", "verification_status"]

    def get_queryset(self):
        return Image.objects.select_related("uploaded_by").order_by("-uploaded_at")

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        image = self.get_object()
        image.verification_status = "verified"
        image.save()
        return Response(self.get_serializer(image).data)

    @action(detail=True, methods=["post"])
    def flag(self, request, pk=None):
        image = self.get_object()
        image.verification_status = "flagged"
        image.flagged_reason = request.data.get("reason", "")
        image.save()
        return Response(self.get_serializer(image).data)

    @action(detail=True, methods=["post"])
    def remove(self, request, pk=None):
        image = self.get_object()
        image.verification_status = "removed"
        image.save()
        return Response(self.get_serializer(image).data)


class AdminSystemConfigViewSet(viewsets.ModelViewSet):
    """Edit key/value system configuration entries."""
    serializer_class = AdminSystemConfigSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = SystemConfig.objects.all().order_by("config_key")
