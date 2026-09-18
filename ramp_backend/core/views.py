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


