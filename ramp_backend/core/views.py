from decimal import Decimal
from django.conf import settings
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db import models
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
    AttributeVerification, Badge, Facility, FacilityAttribute, FacilityType, Image,
    Place, PlaceCategory, PlaceReview, PlaceReviewHelpful, SavedPlace, SystemConfig, User, UserBadge, VerificationStatus,
)
from .permissions import CanVerifySubmissions, IsOwnerOrReadOnly
from .serializers import (
    AccessPointAttributeSerializer, AccessPointSerializer,
    AttributeDefinitionSerializer, BadgeSerializer, FacilityAttributeSerializer,
    FacilitySerializer, FacilityTypeSerializer, ImageMetaSerializer,
    ImageUploadSerializer, PlaceCategorySerializer, PlaceDetailSerializer,
    PlaceListSerializer, PlaceReviewSerializer, RegisterSerializer, SavedPlaceSerializer,
    UserBadgeSerializer, UserSerializer,
)
from .gamification import (
    REWARD_TIERS, evaluate_and_award_badges, get_leaderboard_data,
    get_user_milestones, get_user_reward_tier, get_user_stats,
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
        evaluate_and_award_badges(self.request.user)
        return self.request.user


class ChangePasswordView(APIView):
    """POST {old_password, new_password} — changes the authenticated user's password."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        old_pw = request.data.get("old_password", "")
        new_pw = request.data.get("new_password", "")
        if not request.user.check_password(old_pw):
            return Response({"detail": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_pw) < 8:
            return Response({"detail": "New password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new_pw)
        request.user.save()
        return Response({"detail": "Password changed successfully."})


class MyPlacesView(generics.ListAPIView):
    """GET /api/auth/my-places/ — places submitted by the authenticated user."""
    serializer_class = PlaceListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Place.objects.filter(added_by=self.request.user).select_related("category").order_by("-created_at")


class MyAttributesView(generics.ListAPIView):
    """GET /api/auth/my-attributes/ — access point attributes submitted by the authenticated user."""
    serializer_class = AccessPointAttributeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AccessPointAttribute.objects.filter(submitted_by=self.request.user).order_by("-submitted_at")


class SavedPlacesView(generics.ListCreateAPIView):
    """GET/POST /api/auth/saved-places/ — list or save accessible bookmarks."""
    serializer_class = SavedPlaceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavedPlace.objects.filter(user=self.request.user).select_related("place", "place__category")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SavedPlaceDetailView(generics.DestroyAPIView):
    """DELETE /api/auth/saved-places/{place_id}/ — remove bookmark."""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, place_id=None):
        SavedPlace.objects.filter(user=request.user, place_id=place_id).delete()
        return Response({"detail": "Bookmark removed."}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Places
# ---------------------------------------------------------------------------

class PlaceCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PlaceCategory.objects.all()
    serializer_class = PlaceCategorySerializer
    permission_classes = [permissions.AllowAny]


class FacilityTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """Public read-only list of facility types (Elevator, Ramp, etc.)."""
    queryset = FacilityType.objects.all().order_by("name")
    serializer_class = FacilityTypeSerializer
    permission_classes = [permissions.AllowAny]


def get_verification_threshold():
    """
    Returns the number of confirmations needed to flip pending -> verified.
    Checks the SystemConfig database table first, then settings.RAMP_CONFIG.
    Defaults to 1 so that one independent peer confirmation verifies a submission.
    """
    try:
        cfg = SystemConfig.objects.filter(config_key="VERIFICATION_THRESHOLD").first()
        if cfg and cfg.config_value.strip().isdigit():
            return max(1, int(cfg.config_value.strip()))
    except Exception:
        pass
    ramp_cfg = getattr(settings, "RAMP_CONFIG", {})
    return ramp_cfg.get("VERIFICATION_THRESHOLD", 1)


def update_place_accessibility_score(place):
    """
    Computes an overall accessibility score (0 to 100) based on:
    1. Entrance accessibility (is_accessible, is_primary_accessible_entrance)
    2. Attribute verification confidence (percentage of attributes verified vs pending/disputed)
    3. Facility accessibility (accessible amenities)
    """
    access_points = list(place.access_points.prefetch_related("attributes").all())
    facilities = list(place.facilities.prefetch_related("attributes").all())

    if not access_points and not facilities:
        place.overall_accessibility_score = Decimal("0.00")
        place.save(update_fields=["overall_accessibility_score"])
        return Decimal("0.00")

    # 1. Entrance accessibility (0 - 35 points)
    entrance_points = 0.0
    has_accessible_entrance = False
    if access_points:
        has_accessible_entrance = any(ap.is_accessible for ap in access_points)
        has_primary = any(ap.is_accessible and ap.is_primary_accessible_entrance for ap in access_points)
        if has_primary:
            entrance_points = 35.0
        elif has_accessible_entrance:
            entrance_points = 25.0
        else:
            entrance_points = 5.0
    else:
        entrance_points = 15.0

    # 2. Attribute verification confidence (0 - 50 points)
    all_attributes = []
    for ap in access_points:
        all_attributes.extend(ap.attributes.all())
    for f in facilities:
        all_attributes.extend(f.attributes.all())

    if all_attributes:
        total_attrs = len(all_attributes)
        verified_attrs = sum(1 for a in all_attributes if a.verification_status == VerificationStatus.VERIFIED)
        disputed_attrs = sum(1 for a in all_attributes if a.verification_status in (VerificationStatus.DISPUTED, VerificationStatus.REJECTED))

        verified_ratio = verified_attrs / total_attrs
        disputed_ratio = disputed_attrs / total_attrs
        attr_points = (verified_ratio * 50.0) - (disputed_ratio * 25.0)
        attr_points = max(0.0, attr_points)
    else:
        verified_attrs = 0
        attr_points = 20.0 if has_accessible_entrance else 0.0

    # 3. Facilities accessibility (0 - 15 points)
    facility_points = 0.0
    if facilities:
        accessible_fac = sum(1 for f in facilities if f.is_accessible)
        facility_points = (accessible_fac / len(facilities)) * 15.0
    else:
        facility_points = 15.0 if (has_accessible_entrance and (not all_attributes or verified_attrs > 0)) else 0.0

    score = entrance_points + attr_points + facility_points
    score = min(100.0, max(0.0, score))

    place.overall_accessibility_score = Decimal(f"{score:.2f}")
    place.save(update_fields=["overall_accessibility_score"])
    return place.overall_accessibility_score


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
        params = self.request.query_params

        # Geolocation proximity filter
        near = params.get("near")   # "lat,lng"
        radius_km = params.get("radius", "5")
        if near:
            try:
                lat, lng = (float(x) for x in near.split(","))
                point = Point(lng, lat, srid=4326)
                qs = qs.filter(primary_location__distance_lte=(point, D(km=float(radius_km))))
            except (ValueError, TypeError):
                pass

        # Text search (name, city, address)
        q = params.get("q")
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(name__icontains=q) | Q(city__icontains=q) | Q(address__icontains=q))

        # Advanced accessibility filters
        min_score = params.get("min_score")
        if min_score:
            try:
                qs = qs.filter(overall_accessibility_score__gte=float(min_score))
            except ValueError:
                pass

        if params.get("has_accessible_entrance") == "true":
            qs = qs.filter(access_points__is_accessible=True)

        if params.get("has_accessible_restroom") == "true":
            qs = qs.filter(facilities__facility_type__name__icontains="Restroom", facilities__is_accessible=True)

        if params.get("has_elevator") == "true":
            qs = qs.filter(facilities__facility_type__name__icontains="Elevator", facilities__is_accessible=True)

        if params.get("has_ramp") == "true":
            qs = qs.filter(facilities__facility_type__name__icontains="Ramp", facilities__is_accessible=True)

        if params.get("verified_only") == "true":
            from django.db.models import Q
            qs = qs.filter(
                Q(access_points__attributes__verification_status=VerificationStatus.VERIFIED) |
                Q(facilities__attributes__verification_status=VerificationStatus.VERIFIED)
            )

        # Sorting
        sort_by = params.get("sort_by")
        if sort_by == "score_desc":
            qs = qs.order_by("-overall_accessibility_score")
        elif sort_by == "score_asc":
            qs = qs.order_by("overall_accessibility_score")
        elif sort_by == "newest":
            qs = qs.order_by("-created_at")
        elif sort_by == "name":
            qs = qs.order_by("name")
        else:
            qs = qs.order_by("-overall_accessibility_score", "-created_at")

        return qs.distinct()

    def perform_create(self, serializer):
        place = serializer.save(added_by=self.request.user)
        update_place_accessibility_score(place)
        evaluate_and_award_badges(self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.overall_accessibility_score == 0 and (instance.access_points.exists() or instance.facilities.exists()):
            update_place_accessibility_score(instance)
            instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def score(self, request, pk=None):
        """Transparent, inspectable accessibility score breakdown."""
        place = self.get_object()
        update_place_accessibility_score(place)
        place.refresh_from_db()

        access_points = list(place.access_points.prefetch_related("attributes").all())
        facilities = list(place.facilities.prefetch_related("attributes").all())

        # 1. Entrance accessibility breakdown (0-35)
        total_ap = len(access_points)
        accessible_ap = sum(1 for ap in access_points if ap.is_accessible)
        has_primary = any(ap.is_accessible and ap.is_primary_accessible_entrance for ap in access_points)
        if has_primary:
            entrance_points = 35.0
            entrance_status = "Primary entrance is certified fully accessible (+35 pts)"
        elif accessible_ap > 0:
            entrance_points = 25.0
            entrance_status = f"{accessible_ap} of {total_ap} entrances marked accessible (+25 pts)"
        elif total_ap > 0:
            entrance_points = 5.0
            entrance_status = "No entrances marked accessible (+5 baseline)"
        else:
            entrance_points = 15.0
            entrance_status = "Entrance data pending mapping (+15 baseline)"

        # 2. Attributes breakdown (0-50)
        all_attrs = []
        for ap in access_points:
            all_attrs.extend(ap.attributes.all())
        for f in facilities:
            all_attrs.extend(f.attributes.all())

        total_attrs = len(all_attrs)
        verified_attrs = sum(1 for a in all_attrs if a.verification_status == VerificationStatus.VERIFIED)
        pending_attrs = sum(1 for a in all_attrs if a.verification_status == VerificationStatus.PENDING)
        disputed_attrs = sum(1 for a in all_attrs if a.verification_status in (VerificationStatus.DISPUTED, VerificationStatus.REJECTED))

        if total_attrs > 0:
            verified_ratio = round(verified_attrs / total_attrs, 2)
            disputed_ratio = round(disputed_attrs / total_attrs, 2)
            attr_points = max(0.0, (verified_ratio * 50.0) - (disputed_ratio * 25.0))
            attr_status = f"{verified_attrs} verified of {total_attrs} submitted structured attributes"
        else:
            verified_ratio = 0.0
            disputed_ratio = 0.0
            attr_points = 20.0 if accessible_ap > 0 else 0.0
            attr_status = "No detailed accessibility attributes recorded yet"

        # 3. Facilities breakdown (0-15)
        total_fac = len(facilities)
        accessible_fac = sum(1 for f in facilities if f.is_accessible)
        accessible_types = [f.facility_type.name for f in facilities if f.is_accessible]
        if total_fac > 0:
            facility_points = round((accessible_fac / total_fac) * 15.0, 1)
            facility_status = f"{accessible_fac} of {total_fac} amenities are accessible"
        else:
            facility_points = 15.0 if (accessible_ap > 0 and (not all_attrs or verified_attrs > 0)) else 0.0
            facility_status = "No interior amenities mapped yet"

        recommendations = []
        if pending_attrs > 0:
            recommendations.append(f"Peer-confirm the {pending_attrs} pending attribute(s) to verify data accuracy.")
        if total_ap == 0:
            recommendations.append("Map at least one access entrance to confirm building accessibility.")
        elif accessible_ap == 0:
            recommendations.append("Check if an accessible alternative entrance or ramp exists.")
        if not any("restroom" in f.facility_type.name.lower() for f in facilities):
            recommendations.append("Tag restroom facilities to record wheelchair washroom availability.")
        if not any("elevator" in f.facility_type.name.lower() for f in facilities):
            recommendations.append("Map elevators or step-free level connections if multi-story.")

        return Response({
            "overall_accessibility_score": float(place.overall_accessibility_score),
            "entrance": {
                "score": entrance_points,
                "max": 35,
                "total": total_ap,
                "accessible": accessible_ap,
                "has_primary": has_primary,
                "description": entrance_status,
            },
            "attributes": {
                "score": round(attr_points, 1),
                "max": 50,
                "total": total_attrs,
                "verified": verified_attrs,
                "pending": pending_attrs,
                "disputed": disputed_attrs,
                "verified_ratio": verified_ratio,
                "description": attr_status,
            },
            "facilities": {
                "score": facility_points,
                "max": 15,
                "total": total_fac,
                "accessible": accessible_fac,
                "accessible_types": accessible_types,
                "description": facility_status,
            },
            "recommendations": recommendations,
        })

    @action(detail=True, methods=["post", "delete"], permission_classes=[permissions.IsAuthenticated])
    def bookmark(self, request, pk=None):
        """Toggle saving/bookmarking a place for quick access."""
        place = self.get_object()
        if request.method == "POST":
            notes = request.data.get("notes", "")
            saved, created = SavedPlace.objects.get_or_create(
                user=request.user, place=place, defaults={"notes": notes}
            )
            if not created and notes:
                saved.notes = notes
                saved.save(update_fields=["notes"])
            return Response({"is_saved": True, "notes": saved.notes, "message": "Place saved to your bookmarks."})
        else:
            SavedPlace.objects.filter(user=request.user, place=place).delete()
            return Response({"is_saved": False, "message": "Bookmark removed."})


class PlaceReviewViewSet(viewsets.ModelViewSet):
    """Community accessibility reviews with profile context, tags, and helpfulness voting."""
    serializer_class = PlaceReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        place_pk = self.kwargs.get("place_pk")
        qs = PlaceReview.objects.filter(place_id=place_pk).select_related(
            "user", "accessibility_profile", "place"
        )
        profile_code = self.request.query_params.get("profile")
        if profile_code:
            qs = qs.filter(accessibility_profile__code=profile_code)
        tag = self.request.query_params.get("tag")
        if tag:
            qs = qs.filter(tags__contains=[tag])
        return qs

    def perform_create(self, serializer):
        place_pk = self.kwargs.get("place_pk")
        place = Place.objects.get(pk=place_pk)
        serializer.save(place=place, user=self.request.user)
        evaluate_and_award_badges(self.request.user)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def helpful(self, request, place_pk=None, pk=None):
        review = self.get_object()
        vote = PlaceReviewHelpful.objects.filter(review=review, user=request.user).first()
        if vote:
            vote.delete()
            review.helpful_count = max(0, review.helpful_count - 1)
            review.save(update_fields=["helpful_count"])
            has_voted = False
        else:
            PlaceReviewHelpful.objects.create(review=review, user=request.user)
            review.helpful_count += 1
            review.save(update_fields=["helpful_count"])
            has_voted = True
        return Response({
            "helpful_count": review.helpful_count,
            "has_voted_helpful": has_voted,
        })

    @action(detail=False, methods=["get"])
    def stats(self, request, place_pk=None):
        reviews = PlaceReview.objects.filter(place_id=place_pk)
        total = reviews.count()
        if total == 0:
            return Response({
                "average_rating": 0,
                "total_reviews": 0,
                "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
                "top_tags": [],
                "profile_counts": {},
            })
        from django.db.models import Avg, Count
        avg = reviews.aggregate(Avg("rating"))["rating__avg"] or 0
        dist = {i: 0 for i in range(1, 6)}
        for r in reviews.values("rating").annotate(count=Count("id")):
            dist[r["rating"]] = r["count"]

        tag_counts = {}
        profile_counts = {}
        for rev in reviews:
            for t in rev.tags:
                tag_counts[t] = tag_counts.get(t, 0) + 1
            if rev.accessibility_profile:
                lbl = rev.accessibility_profile.label
                profile_counts[lbl] = profile_counts.get(lbl, 0) + 1

        top_tags = sorted([{"tag": k, "count": v} for k, v in tag_counts.items()], key=lambda x: -x["count"])[:8]

        return Response({
            "average_rating": round(float(avg), 1),
            "total_reviews": total,
            "rating_distribution": dist,
            "top_tags": top_tags,
            "profile_counts": profile_counts,
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
        ap = serializer.save(place_id=self.kwargs["place_pk"])
        update_place_accessibility_score(ap.place)

    def perform_update(self, serializer):
        ap = serializer.save()
        update_place_accessibility_score(ap.place)

    def perform_destroy(self, instance):
        place = instance.place
        super().perform_destroy(instance)
        update_place_accessibility_score(place)


class AccessPointAttributeViewSet(viewsets.ModelViewSet):
    serializer_class = AccessPointAttributeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return AccessPointAttribute.objects.filter(
            access_point_id=self.kwargs["access_point_pk"]
        ).order_by("id")

    def perform_create(self, serializer):
        attr = serializer.save(access_point_id=self.kwargs["access_point_pk"])
        update_place_accessibility_score(attr.access_point.place)
        if self.request.user.is_authenticated:
            evaluate_and_award_badges(self.request.user)

    def perform_update(self, serializer):
        attr = serializer.save()
        update_place_accessibility_score(attr.access_point.place)

    def perform_destroy(self, instance):
        place = instance.access_point.place
        super().perform_destroy(instance)
        update_place_accessibility_score(place)

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
        qs = Facility.objects.all().order_by("id")
        place_id = self.kwargs.get("place_pk")
        if place_id:
            qs = qs.filter(place_id=place_id)
        return qs

    def perform_create(self, serializer):
        fac = serializer.save(place_id=self.kwargs["place_pk"])
        update_place_accessibility_score(fac.place)

    def perform_update(self, serializer):
        fac = serializer.save()
        update_place_accessibility_score(fac.place)

    def perform_destroy(self, instance):
        place = instance.place
        super().perform_destroy(instance)
        update_place_accessibility_score(place)


class FacilityAttributeViewSet(viewsets.ModelViewSet):
    serializer_class = FacilityAttributeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return FacilityAttribute.objects.filter(
            facility_id=self.kwargs["facility_pk"]
        ).order_by("id")

    def perform_create(self, serializer):
        attr = serializer.save(facility_id=self.kwargs["facility_pk"])
        update_place_accessibility_score(attr.facility.place)
        if self.request.user.is_authenticated:
            evaluate_and_award_badges(self.request.user)

    def perform_update(self, serializer):
        attr = serializer.save()
        update_place_accessibility_score(attr.facility.place)

    def perform_destroy(self, instance):
        place = instance.facility.place
        super().perform_destroy(instance)
        update_place_accessibility_score(place)

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
        threshold = get_verification_threshold()
        is_admin_or_staff = (
            request.user.is_staff or
            getattr(request.user, "user_type", None) in ("admin", "moderator")
        )
        if attribute.verified_count >= threshold or is_admin_or_staff:
            attribute.verification_status = VerificationStatus.VERIFIED

        # Give reputation rewards
        if attribute.submitted_by_id and attribute.submitted_by_id != request.user.id:
            User.objects.filter(id=attribute.submitted_by_id).update(
                reputation_score=models.F("reputation_score") + 5
            )
            submitter = User.objects.filter(id=attribute.submitted_by_id).first()
            if submitter:
                evaluate_and_award_badges(submitter)

        User.objects.filter(id=request.user.id).update(
            reputation_score=models.F("reputation_score") + 2
        )
        request.user.refresh_from_db(fields=["reputation_score"])
        evaluate_and_award_badges(request.user)
    elif action_value == "dispute":
        attribute.verification_status = VerificationStatus.DISPUTED
    elif action_value == "reject":
        attribute.verification_status = VerificationStatus.REJECTED

    attribute.save()

    # Recalculate place accessibility score
    place = None
    if table_name == "access_point" and hasattr(attribute, "access_point"):
        place = attribute.access_point.place
    elif table_name == "facility" and hasattr(attribute, "facility"):
        place = attribute.facility.place

    if place:
        update_place_accessibility_score(place)

    serializer_cls = (
        AccessPointAttributeSerializer if table_name == "access_point" else FacilityAttributeSerializer
    )
    return Response(serializer_cls(attribute, context={"request": request}).data)


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
        response = super().create(request, *args, **kwargs)
        if request.user.is_authenticated:
            evaluate_and_award_badges(request.user)
        return response

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
# Module 5: Gamification, Badges & Leaderboard Endpoints
# ---------------------------------------------------------------------------

class BadgesListView(generics.ListAPIView):
    """GET /api/badges/ — lists all active badges and unlock criteria."""
    serializer_class = BadgeSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        from .gamification import ensure_default_badges
        ensure_default_badges()
        return Badge.objects.filter(is_active=True).order_by("category", "threshold")


class MyBadgesView(APIView):
    """GET /api/badges/my/ — current user's badges, tier status, and milestones."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        evaluate_and_award_badges(request.user)
        user_badges = UserBadge.objects.filter(user=request.user).select_related("badge")
        stats = get_user_stats(request.user)
        tier = get_user_reward_tier(request.user.reputation_score)
        milestones = get_user_milestones(request.user)

        return Response({
            "badges": UserBadgeSerializer(user_badges, many=True).data,
            "stats": stats,
            "tier": tier,
            "milestones": milestones,
        })


class ContributionMilestonesView(APIView):
    """GET /api/badges/milestones/ — contribution milestones roadmap with progress."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        if user:
            evaluate_and_award_badges(user)
        milestones = get_user_milestones(user)
        return Response({
            "milestones": milestones,
        })


class RewardTiersView(APIView):
    """GET /api/badges/tiers/ — reward tier thresholds, perks, and user status."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user_tier = None
        if request.user.is_authenticated:
            user_tier = get_user_reward_tier(request.user.reputation_score)
        return Response({
            "tiers": REWARD_TIERS,
            "user_tier": user_tier,
        })


class LeaderboardView(APIView):
    """GET /api/leaderboard/?type=reputation|verifications|places|badges — community rankings."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        ranking_type = request.query_params.get("type", "reputation")
        try:
            limit = min(100, max(1, int(request.query_params.get("limit", 50))))
        except (ValueError, TypeError):
            limit = 50

        data = get_leaderboard_data(
            ranking_type=ranking_type,
            current_user=request.user,
            limit=limit,
        )
        return Response(data)


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
