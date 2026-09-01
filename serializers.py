import base64

from django.contrib.gis.geos import Point
from rest_framework import serializers

from .models import (
    AccessibilityProfile, AccessPoint, AccessPointAttribute,
    AttributeDefinition, Facility, FacilityAttribute, FacilityType,
    FloorPlan, Image, Place, PlaceCategory, User, UserAccessibilityProfile,
    VerticalConnection, Waypoint, WaypointEdge,
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

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "user_type", "reputation_score", "is_verified_email",
            "accessibility_profiles", "accessibility_profile_codes",
        ]
        read_only_fields = ["id", "reputation_score", "is_verified_email", "user_type"]

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
    """Lightweight serializer for map/list views."""
    primary_location = PointField()
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Place
        fields = [
            "id", "name", "category", "category_name", "primary_location",
            "description", "city", "overall_accessibility_score",
        ]


class PlaceDetailSerializer(serializers.ModelSerializer):
    """Full serializer including nested access points and facilities."""
    primary_location = PointField()
    category_name = serializers.CharField(source="category.name", read_only=True)
    access_points = AccessPointSerializer(many=True, read_only=True)
    facilities = FacilitySerializer(many=True, read_only=True)

    class Meta:
        model = Place
        fields = [
            "id", "name", "category", "category_name", "primary_location",
            "description", "address", "city", "added_by", "claimed_by_venue",
            "overall_accessibility_score", "access_points", "facilities",
            "created_at", "updated_at",
        ]
        read_only_fields = ["added_by", "claimed_by_venue", "overall_accessibility_score",
                             "created_at", "updated_at"]

    def create(self, validated_data):
        validated_data["added_by"] = self.context["request"].user
        return super().create(validated_data)


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

    class Meta:
        model = AccessPointAttribute
        fields = [
            "id", "access_point", "attribute_definition", "attribute_name",
            "value_boolean", "value_number", "value_text", "submitted_by",
            "submitted_at", "verification_status", "verified_count", "last_verified_at",
        ]
        read_only_fields = [
            "access_point", "submitted_by", "submitted_at", "verification_status",
            "verified_count", "last_verified_at",
        ]

    def create(self, validated_data):
        validated_data["submitted_by"] = self.context["request"].user
        return super().create(validated_data)


class FacilityAttributeSerializer(serializers.ModelSerializer):
    attribute_name = serializers.CharField(source="attribute_definition.name", read_only=True)

    class Meta:
        model = FacilityAttribute
        fields = [
            "id", "facility", "attribute_definition", "attribute_name",
            "value_boolean", "value_number", "value_text", "submitted_by",
            "submitted_at", "verification_status", "verified_count", "last_verified_at",
        ]
        read_only_fields = [
            "facility", "submitted_by", "submitted_at", "verification_status",
            "verified_count", "last_verified_at",
        ]

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
# Indoor Navigation
# ---------------------------------------------------------------------------

class FloorPlanUploadSerializer(serializers.ModelSerializer):
    """Accepts a multipart floor plan image upload."""
    file = serializers.ImageField(write_only=True)

    class Meta:
        model = FloorPlan
        fields = ["id", "place", "floor_level", "file", "width_px", "height_px", "uploaded_by", "uploaded_at"]
        read_only_fields = ["place", "width_px", "height_px", "uploaded_by", "uploaded_at"]

    def create(self, validated_data):
        from PIL import Image as PILImage
        import io

        file_obj = validated_data.pop("file")
        image_bytes = file_obj.read()
        pil_img = PILImage.open(io.BytesIO(image_bytes))
        width, height = pil_img.size

        return FloorPlan.objects.create(
            place_id=self.context["place_id"],
            floor_level=validated_data["floor_level"],
            image_data=image_bytes,
            content_type=file_obj.content_type,
            width_px=width,
            height_px=height,
            uploaded_by=self.context["request"].user,
        )


class FloorPlanMetaSerializer(serializers.ModelSerializer):
    class Meta:
        model = FloorPlan
        fields = ["id", "place", "floor_level", "width_px", "height_px", "uploaded_by", "uploaded_at"]


class WaypointSerializer(serializers.ModelSerializer):
    class Meta:
        model = Waypoint
        fields = [
            "id", "floor_plan", "label", "waypoint_type", "x", "y",
            "linked_facility", "linked_access_point", "qr_code_value",
        ]
        read_only_fields = ["floor_plan"]


class WaypointEdgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaypointEdge
        fields = [
            "id", "floor_plan", "from_waypoint", "to_waypoint",
            "distance_meters", "path_type", "is_accessible", "notes",
        ]
        read_only_fields = ["floor_plan"]


class VerticalConnectionSerializer(serializers.ModelSerializer):
    from_waypoint_label = serializers.CharField(source="from_waypoint.label", read_only=True)
    to_waypoint_label = serializers.CharField(source="to_waypoint.label", read_only=True)

    class Meta:
        model = VerticalConnection
        fields = [
            "id", "place", "from_waypoint", "from_waypoint_label",
            "to_waypoint", "to_waypoint_label", "connection_type",
            "distance_meters", "is_accessible", "notes",
        ]
        read_only_fields = ["place"]


class PlaceRouteRequestSerializer(serializers.Serializer):
    """Input for the place-wide (multi-floor) route-finding endpoint."""
    from_waypoint = serializers.IntegerField()
    to_waypoint = serializers.IntegerField()
    require_accessible = serializers.BooleanField(default=True)


class RouteRequestSerializer(serializers.Serializer):
    """Input for the indoor route-finding endpoint."""
    from_waypoint = serializers.IntegerField()
    to_waypoint = serializers.IntegerField()
    require_accessible = serializers.BooleanField(default=True)


class WaypointScanResultSerializer(serializers.ModelSerializer):
    """Returned when a QR checkpoint is scanned - includes floor plan context
    so the frontend can jump straight to the right floor plan viewer."""
    floor_plan_id = serializers.IntegerField(source="floor_plan.id", read_only=True)
    place_id = serializers.IntegerField(source="floor_plan.place_id", read_only=True)
    floor_level = serializers.CharField(source="floor_plan.floor_level", read_only=True)

    class Meta:
        model = Waypoint
        fields = [
            "id", "label", "waypoint_type", "x", "y",
            "floor_plan_id", "place_id", "floor_level",
        ]
