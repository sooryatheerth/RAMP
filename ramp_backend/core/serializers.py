import base64

from django.contrib.gis.geos import Point
from rest_framework import serializers

from .models import (
    AccessibilityProfile, AccessPoint, AccessPointAttribute,
    AttributeDefinition, AttributeVerification, Badge, Facility, FacilityAttribute, FacilityType,
    Image, Place, PlaceCategory, PlaceReview, PlaceReviewHelpful, SavedPlace, User, UserAccessibilityProfile, UserBadge,
)


# ---------------------------------------------------------------------------
# Users & Auth
# ---------------------------------------------------------------------------

class AccessibilityProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccessibilityProfile
        fields = ["id", "code", "label"]


class UserSerializer(serializers.ModelSerializer):
    accessibility_profiles = serializers.SerializerMethodField()
    accessibility_profile_codes = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )
    reward_tier = serializers.SerializerMethodField()
    badges_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "user_type", "reputation_score", "is_verified_email",
            "accessibility_profiles", "accessibility_profile_codes",
            "reward_tier", "badges_count",
        ]
        read_only_fields = [
            "id", "reputation_score", "is_verified_email", "user_type",
            "reward_tier", "badges_count",
        ]

    def get_reward_tier(self, obj):
        from .gamification import get_user_reward_tier
        return get_user_reward_tier(obj.reputation_score)

    def get_badges_count(self, obj):
        return obj.user_badges.count()

    def get_accessibility_profiles(self, obj):
        profiles = AccessibilityProfile.objects.filter(useraccessibilityprofile__user=obj)
        return AccessibilityProfileSerializer(profiles, many=True).data

    def update(self, instance, validated_data):
        codes = validated_data.pop("accessibility_profile_codes", None)
        instance = super().update(instance, validated_data)
        if codes is not None:
            UserAccessibilityProfile.objects.filter(user=instance).delete()
            profiles = AccessibilityProfile.objects.filter(code__in=codes)
            UserAccessibilityProfile.objects.bulk_create(
                [UserAccessibilityProfile(user=instance, profile=p) for p in profiles]
            )
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["username", "email", "password"]

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )
        return user


# ---------------------------------------------------------------------------
# Places, Access Points, Facilities
# ---------------------------------------------------------------------------

class PlaceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaceCategory
        fields = ["id", "name"]


class FacilityTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacilityType
        fields = ["id", "name"]


class PointField(serializers.Field):
    """Serializes a GEOSGeometry Point as {"lat": .., "lng": ..} and parses it back."""

    def to_representation(self, value):
        if value is None:
            return None
        return {"lat": value.y, "lng": value.x}

    def to_internal_value(self, data):
        try:
            return Point(float(data["lng"]), float(data["lat"]), srid=4326)
        except (KeyError, TypeError, ValueError):
            raise serializers.ValidationError("Expected {'lat': <float>, 'lng': <float>}")


class AccessPointSerializer(serializers.ModelSerializer):
    location = PointField()

    class Meta:
        model = AccessPoint
        fields = [
            "id", "place", "label", "location", "is_accessible",
            "is_primary_accessible_entrance", "notes", "created_at", "updated_at",
        ]
        # 'place' is supplied by the URL (perform_create), not the request body
        read_only_fields = ["place", "created_at", "updated_at"]


class FacilitySerializer(serializers.ModelSerializer):
    facility_type_name = serializers.CharField(source="facility_type.name", read_only=True)

    class Meta:
        model = Facility
        fields = [
            "id", "place", "facility_type", "facility_type_name", "floor_level",
            "location_description", "is_accessible", "nearest_access_point",
            "created_at", "updated_at",
        ]
        # 'place' is supplied by the URL (perform_create), not the request body
        read_only_fields = ["place", "created_at", "updated_at"]


class PlaceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for map/list views with traits, rating, and bookmark status."""
    primary_location = PointField()
    category_name = serializers.CharField(source="category.name", read_only=True)
    is_saved = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    has_accessible_entrance = serializers.SerializerMethodField()
    has_accessible_restroom = serializers.SerializerMethodField()
    has_elevator = serializers.SerializerMethodField()
    has_ramp = serializers.SerializerMethodField()

    class Meta:
        model = Place
        fields = [
            "id", "name", "category", "category_name", "primary_location",
            "description", "address", "city", "overall_accessibility_score",
            "is_saved", "average_rating", "reviews_count",
            "has_accessible_entrance", "has_accessible_restroom", "has_elevator", "has_ramp",
        ]

    def get_is_saved(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return obj.saved_by_users.filter(user=request.user).exists()

    def get_average_rating(self, obj):
        from django.db.models import Avg
        avg = obj.reviews.aggregate(Avg("rating"))["rating__avg"]
        return round(float(avg), 1) if avg else None

    def get_reviews_count(self, obj):
        return obj.reviews.count()

    def get_has_accessible_entrance(self, obj):
        return obj.access_points.filter(is_accessible=True).exists()

    def get_has_accessible_restroom(self, obj):
        return obj.facilities.filter(facility_type__name__icontains="Restroom", is_accessible=True).exists()

    def get_has_elevator(self, obj):
        return obj.facilities.filter(facility_type__name__icontains="Elevator", is_accessible=True).exists()

    def get_has_ramp(self, obj):
        return obj.facilities.filter(facility_type__name__icontains="Ramp", is_accessible=True).exists()


class PlaceDetailSerializer(serializers.ModelSerializer):
    """Full serializer including nested access points, facilities, reviews summary, and saved status."""
    primary_location = PointField()
    category_name = serializers.CharField(source="category.name", read_only=True)
    added_by_username = serializers.CharField(source="added_by.username", read_only=True)
    added_by_tier = serializers.SerializerMethodField()
    access_points = AccessPointSerializer(many=True, read_only=True)
    facilities = FacilitySerializer(many=True, read_only=True)
    is_saved = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()

    class Meta:
        model = Place
        fields = [
            "id", "name", "category", "category_name", "primary_location",
            "description", "address", "city", "added_by", "added_by_username", "added_by_tier",
            "claimed_by_venue", "overall_accessibility_score", "access_points", "facilities",
            "is_saved", "average_rating", "reviews_count",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "added_by", "added_by_username", "added_by_tier", "claimed_by_venue",
            "overall_accessibility_score", "is_saved", "average_rating", "reviews_count",
            "created_at", "updated_at",
        ]

    def get_is_saved(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return obj.saved_by_users.filter(user=request.user).exists()

    def get_average_rating(self, obj):
        from django.db.models import Avg
        avg = obj.reviews.aggregate(Avg("rating"))["rating__avg"]
        return round(float(avg), 1) if avg else None

    def get_reviews_count(self, obj):
        return obj.reviews.count()

    def get_added_by_tier(self, obj):
        if obj.added_by:
            from .gamification import get_user_reward_tier
            return get_user_reward_tier(obj.added_by.reputation_score)
        return None

    def create(self, validated_data):
        validated_data["added_by"] = self.context["request"].user
        return super().create(validated_data)


# ---------------------------------------------------------------------------
# Module 6: Place Reviews Serializers
# ---------------------------------------------------------------------------

class PlaceReviewSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    user_tier = serializers.SerializerMethodField()
    accessibility_profile_label = serializers.CharField(source="accessibility_profile.label", read_only=True)
    is_my_review = serializers.SerializerMethodField()
    has_voted_helpful = serializers.SerializerMethodField()

    class Meta:
        model = PlaceReview
        fields = [
            "id", "place", "user", "user_username", "user_tier",
            "rating", "title", "review_text", "accessibility_profile",
            "accessibility_profile_label", "tags", "visit_date",
            "helpful_count", "has_voted_helpful", "is_my_review",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "place", "user", "user_username", "user_tier",
            "accessibility_profile_label", "helpful_count", "has_voted_helpful",
            "is_my_review", "created_at", "updated_at",
        ]

    def get_user_tier(self, obj):
        if obj.user:
            from .gamification import get_user_reward_tier
            return get_user_reward_tier(obj.user.reputation_score)
        return None

    def get_is_my_review(self, obj):
        request = self.context.get("request")
        return bool(request and request.user and request.user.is_authenticated and obj.user_id == request.user.id)

    def get_has_voted_helpful(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return PlaceReviewHelpful.objects.filter(review=obj, user=request.user).exists()

    def create(self, validated_data):
        request = self.context["request"]
        validated_data["user"] = request.user
        review = super().create(validated_data)

        # Award contributor reputation (+5 points for an accessibility review)
        if request.user and request.user.is_authenticated:
            request.user.reputation_score += 5
            request.user.save(update_fields=["reputation_score"])

        return review


# ---------------------------------------------------------------------------
# Saved Places Serializer
# ---------------------------------------------------------------------------

class SavedPlaceSerializer(serializers.ModelSerializer):
    place = PlaceListSerializer(read_only=True)
    place_id = serializers.PrimaryKeyRelatedField(
        queryset=Place.objects.all(), source="place", write_only=True
    )

    class Meta:
        model = SavedPlace
        fields = ["id", "place", "place_id", "notes", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        user = self.context["request"].user
        saved, _ = SavedPlace.objects.get_or_create(
            user=user,
            place=validated_data["place"],
            defaults={"notes": validated_data.get("notes", "")}
        )
        return saved


# ---------------------------------------------------------------------------
# Accessibility Attributes
# ---------------------------------------------------------------------------

class AttributeDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttributeDefinition
        fields = [
            "id", "applies_to", "facility_type", "name", "data_type",
            "unit", "choice_options", "is_required",
        ]


class AccessPointAttributeSerializer(serializers.ModelSerializer):
    attribute_name = serializers.CharField(source="attribute_definition.name", read_only=True)
    submitted_by_username = serializers.CharField(source="submitted_by.username", read_only=True)
    submitted_by_tier = serializers.SerializerMethodField()
    user_action = serializers.SerializerMethodField()

    class Meta:
        model = AccessPointAttribute
        fields = [
            "id", "access_point", "attribute_definition", "attribute_name",
            "value_boolean", "value_number", "value_text", "submitted_by",
            "submitted_by_username", "submitted_by_tier", "user_action",
            "submitted_at", "verification_status", "verified_count", "last_verified_at",
        ]
        read_only_fields = [
            "access_point", "submitted_by", "submitted_by_username", "submitted_by_tier",
            "submitted_at", "verification_status", "verified_count", "last_verified_at",
        ]

    def get_submitted_by_tier(self, obj):
        if obj.submitted_by:
            from .gamification import get_user_reward_tier
            return get_user_reward_tier(obj.submitted_by.reputation_score)
        return None

    def get_user_action(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return None
        return AttributeVerification.objects.filter(
            attribute_row_id=obj.id,
            attribute_table="access_point",
            verified_by=request.user,
        ).values_list("action", flat=True).first()

    def create(self, validated_data):
        validated_data["submitted_by"] = self.context["request"].user
        return super().create(validated_data)


class FacilityAttributeSerializer(serializers.ModelSerializer):
    attribute_name = serializers.CharField(source="attribute_definition.name", read_only=True)
    submitted_by_username = serializers.CharField(source="submitted_by.username", read_only=True)
    submitted_by_tier = serializers.SerializerMethodField()
    user_action = serializers.SerializerMethodField()

    class Meta:
        model = FacilityAttribute
        fields = [
            "id", "facility", "attribute_definition", "attribute_name",
            "value_boolean", "value_number", "value_text", "submitted_by",
            "submitted_by_username", "submitted_by_tier", "user_action",
            "submitted_at", "verification_status", "verified_count", "last_verified_at",
        ]
        read_only_fields = [
            "facility", "submitted_by", "submitted_by_username", "submitted_by_tier",
            "submitted_at", "verification_status", "verified_count", "last_verified_at",
        ]

    def get_submitted_by_tier(self, obj):
        if obj.submitted_by:
            from .gamification import get_user_reward_tier
            return get_user_reward_tier(obj.submitted_by.reputation_score)
        return None

    def get_user_action(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return None
        return AttributeVerification.objects.filter(
            attribute_row_id=obj.id,
            attribute_table="facility",
            verified_by=request.user,
        ).values_list("action", flat=True).first()

    def create(self, validated_data):
        validated_data["submitted_by"] = self.context["request"].user
        return super().create(validated_data)


# ---------------------------------------------------------------------------
# Images (DB-stored binary)
# ---------------------------------------------------------------------------

class ImageUploadSerializer(serializers.ModelSerializer):
    """Accepts a multipart file upload; stores bytes + generates a thumbnail."""
    file = serializers.ImageField(write_only=True)

    class Meta:
        model = Image
        fields = [
            "id", "entity_type", "entity_id", "file", "caption", "alt_text",
            "uploaded_by", "uploaded_at", "verification_status",
        ]
        read_only_fields = ["uploaded_by", "uploaded_at", "verification_status"]

    def validate_alt_text(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Alt text is required for accessibility (WCAG 2.1 AA)."
            )
        return value

    def create(self, validated_data):
        from PIL import Image as PILImage
        import io

        file_obj = validated_data.pop("file")
        image_bytes = file_obj.read()

        # Generate thumbnail
        thumb_io = io.BytesIO()
        pil_img = PILImage.open(io.BytesIO(image_bytes))
        pil_img.thumbnail((300, 300))
        pil_img.save(thumb_io, format=pil_img.format or "JPEG")

        return Image.objects.create(
            entity_type=validated_data["entity_type"],
            entity_id=validated_data["entity_id"],
            image_data=image_bytes,
            content_type=file_obj.content_type,
            file_size_bytes=file_obj.size,
            thumbnail_data=thumb_io.getvalue(),
            caption=validated_data.get("caption", ""),
            alt_text=validated_data["alt_text"],
            uploaded_by=self.context["request"].user,
        )


class ImageMetaSerializer(serializers.ModelSerializer):
    """Metadata-only view (no binary payload) for list endpoints."""
    class Meta:
        model = Image
        fields = [
            "id", "entity_type", "entity_id", "caption", "alt_text",
            "uploaded_by", "uploaded_at", "verification_status", "content_type",
        ]


# ---------------------------------------------------------------------------
# Admin serializers (IsAdminUser only — writable fields the public API hides)
# ---------------------------------------------------------------------------

from .models import (
    VenueOwnerProfile, AccessibilityProfile, UserAccessibilityProfile,
    FacilityType, SystemConfig, AttributeVerification, PlaceCategory,
)


class AdminUserSerializer(serializers.ModelSerializer):
    """Full user record editable by admins."""
    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "user_type", "reputation_score", "is_verified_email",
            "is_active", "is_staff", "is_superuser",
            "date_joined", "last_login", "last_active_at",
        ]
        read_only_fields = ["id", "date_joined", "last_login"]


class AdminVenueOwnerProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = VenueOwnerProfile
        fields = [
            "id", "user", "username", "email",
            "business_name", "approval_status",
            "reviewed_by", "reviewed_at",
        ]
        read_only_fields = ["id", "user", "username", "email", "reviewed_at"]


class AdminPlaceSerializer(serializers.ModelSerializer):
    primary_location = PointField()
    category_name = serializers.CharField(source="category.name", read_only=True)
    added_by_username = serializers.CharField(source="added_by.username", read_only=True)

    class Meta:
        model = Place
        fields = [
            "id", "name", "category", "category_name", "primary_location",
            "description", "address", "city",
            "added_by", "added_by_username", "claimed_by_venue",
            "overall_accessibility_score", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "added_by", "added_by_username", "created_at", "updated_at"]


class AdminImageSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True)

    class Meta:
        model = Image
        fields = [
            "id", "entity_type", "entity_id", "caption", "alt_text",
            "uploaded_by", "uploaded_by_username", "uploaded_at",
            "verification_status", "flagged_reason",
            "content_type", "file_size_bytes",
        ]
        read_only_fields = ["id", "uploaded_by", "uploaded_by_username", "uploaded_at",
                             "content_type", "file_size_bytes"]


class AdminSystemConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemConfig
        fields = ["id", "config_key", "config_value", "description"]
        read_only_fields = ["id"]


class AdminAccessibilityProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccessibilityProfile
        fields = ["id", "code", "label"]


class AdminPlaceCategorySerializer(serializers.ModelSerializer):
    place_count = serializers.SerializerMethodField()

    class Meta:
        model = PlaceCategory
        fields = ["id", "name", "place_count"]

    def get_place_count(self, obj):
        return obj.places.count()


class AdminFacilityTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacilityType
        fields = ["id", "name"]


class AdminAttributeDefinitionSerializer(serializers.ModelSerializer):
    facility_type_name = serializers.CharField(source="facility_type.name", read_only=True)

    class Meta:
        model = AttributeDefinition
        fields = [
            "id", "applies_to", "facility_type", "facility_type_name",
            "name", "data_type", "unit", "choice_options", "is_required",
        ]


class AdminAttributeVerificationSerializer(serializers.ModelSerializer):
    verified_by_username = serializers.CharField(source="verified_by.username", read_only=True)

    class Meta:
        model = AttributeVerification
        fields = [
            "id", "attribute_row_id", "attribute_table",
            "verified_by", "verified_by_username",
            "action", "comment", "created_at",
        ]
        read_only_fields = ["id", "attribute_row_id", "attribute_table",
                             "verified_by", "verified_by_username", "action",
                             "comment", "created_at"]


# ---------------------------------------------------------------------------
# Module 5: Gamification Serializers
# ---------------------------------------------------------------------------

class BadgeSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    tier_label = serializers.CharField(source="get_tier_display", read_only=True)

    class Meta:
        model = Badge
        fields = [
            "id", "code", "name", "description", "category", "category_label",
            "tier", "tier_label", "icon", "metric", "threshold",
            "points_reward", "is_active", "created_at",
        ]


class UserBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)

    class Meta:
        model = UserBadge
        fields = ["id", "badge", "awarded_at"]
