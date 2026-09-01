"""
RAMP core models.
Covers schema Modules 1-4: Users & Auth, Places & Location,
Accessibility Attributes, Images.
Modules 5-9 (Reviews, Routing, Gamification, Notifications, Venue/API)
will live in separate apps added later.
"""
import uuid
from django.contrib.auth.models import AbstractUser
from django.contrib.gis.db import models as gis_models
from django.db import models


# ---------------------------------------------------------------------------
# Module 1: Users & Auth
# ---------------------------------------------------------------------------

class User(AbstractUser):
    class UserType(models.TextChoices):
        INDIVIDUAL = "individual", "Individual"
        VENUE_OWNER = "venue_owner", "Venue owner"
        ADMIN = "admin", "Admin"
        MODERATOR = "moderator", "Moderator"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_type = models.CharField(
        max_length=20, choices=UserType.choices, default=UserType.INDIVIDUAL
    )
    reputation_score = models.IntegerField(default=0)
    is_verified_email = models.BooleanField(default=False)
    last_active_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.username


class AccessibilityProfile(models.Model):
    """Lookup: wheelchair, visual, hearing, elderly, temporary, etc."""
    code = models.SlugField(max_length=30, unique=True)
    label = models.CharField(max_length=50)

    def __str__(self):
        return self.label


class UserAccessibilityProfile(models.Model):
    """Junction table - a user can hold multiple accessibility profiles."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="accessibility_profiles")
    profile = models.ForeignKey(AccessibilityProfile, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("user", "profile")


class VenueOwnerProfile(models.Model):
    class ApprovalStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="venue_profile")
    business_name = models.CharField(max_length=200)
    verification_document = models.BinaryField(null=True, blank=True)
    approval_status = models.CharField(
        max_length=10, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING
    )
    reviewed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_venues"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.business_name


# ---------------------------------------------------------------------------
# Module 2: Places & Location
# ---------------------------------------------------------------------------

class PlaceCategory(models.Model):
    name = models.CharField(max_length=50, unique=True)

    class Meta:
        verbose_name_plural = "Place categories"

    def __str__(self):
        return self.name


class Place(models.Model):
    name = models.CharField(max_length=200)
    category = models.ForeignKey(PlaceCategory, on_delete=models.PROTECT, related_name="places")
    primary_location = gis_models.PointField(geography=True, srid=4326)
    description = models.TextField(blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="added_places")
    claimed_by_venue = models.ForeignKey(
        VenueOwnerProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name="claimed_places"
    )
    overall_accessibility_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class AccessPoint(models.Model):
    """An entrance to a place. A place can have several; each is independently accessible or not."""
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="access_points")
    label = models.CharField(max_length=100)  # e.g. "Main Entrance", "North Gate"
    location = gis_models.PointField(geography=True, srid=4326)
    is_accessible = models.BooleanField(default=False)
    is_primary_accessible_entrance = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.place.name} - {self.label}"


class FacilityType(models.Model):
    """Lookup: Restroom, Elevator, Parking, Ramp, Tactile Path, Braille Signage, etc."""
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class Facility(models.Model):
    """An indoor/outdoor amenity that doesn't need its own GPS point (e.g. a 2nd-floor restroom)."""
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="facilities")
    facility_type = models.ForeignKey(FacilityType, on_delete=models.PROTECT)
    floor_level = models.CharField(max_length=20, blank=True)  # e.g. "Ground", "2nd Floor"
    location_description = models.TextField(blank=True)
    is_accessible = models.BooleanField(default=False)
    nearest_access_point = models.ForeignKey(
        AccessPoint, on_delete=models.SET_NULL, null=True, blank=True, related_name="nearby_facilities"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.place.name} - {self.facility_type.name}"


# ---------------------------------------------------------------------------
# Module 3: Accessibility Attributes (structured, verifiable)
# ---------------------------------------------------------------------------

class AttributeDefinition(models.Model):
    class AppliesTo(models.TextChoices):
        ACCESS_POINT = "access_point", "Access point"
        FACILITY = "facility", "Facility"
        BOTH = "both", "Both"

    class DataType(models.TextChoices):
        BOOLEAN = "boolean", "Boolean"
        NUMBER = "number", "Number"
        TEXT = "text", "Text"
        CHOICE = "choice", "Choice"

    applies_to = models.CharField(max_length=20, choices=AppliesTo.choices)
    facility_type = models.ForeignKey(
        FacilityType, on_delete=models.CASCADE, null=True, blank=True,
        help_text="Set only if this attribute is specific to one facility type."
    )
    name = models.CharField(max_length=100)   # e.g. "Ramp Gradient", "Door Width"
    data_type = models.CharField(max_length=10, choices=DataType.choices)
    unit = models.CharField(max_length=20, blank=True)   # e.g. "cm", "degrees"
    choice_options = models.JSONField(null=True, blank=True)
    is_required = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class VerificationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    VERIFIED = "verified", "Verified"
    DISPUTED = "disputed", "Disputed"
    REJECTED = "rejected", "Rejected"


class AttributeValueBase(models.Model):
    """Shared fields for access-point and facility attribute values."""
    attribute_definition = models.ForeignKey(AttributeDefinition, on_delete=models.CASCADE)
    value_boolean = models.BooleanField(null=True, blank=True)
    value_number = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    value_text = models.TextField(null=True, blank=True)
    submitted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    verification_status = models.CharField(
        max_length=10, choices=VerificationStatus.choices, default=VerificationStatus.PENDING
    )
    verified_count = models.IntegerField(default=0)
    last_verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True


class AccessPointAttribute(AttributeValueBase):
    access_point = models.ForeignKey(AccessPoint, on_delete=models.CASCADE, related_name="attributes")

    def __str__(self):
        return f"{self.access_point} - {self.attribute_definition.name}"


class FacilityAttribute(AttributeValueBase):
    facility = models.ForeignKey(Facility, on_delete=models.CASCADE, related_name="attributes")

    def __str__(self):
        return f"{self.facility} - {self.attribute_definition.name}"


class AttributeVerification(models.Model):
    """Audit trail of confirm/dispute/reject actions on attribute values."""
    class AttributeTable(models.TextChoices):
        ACCESS_POINT = "access_point", "Access point"
        FACILITY = "facility", "Facility"

    class Action(models.TextChoices):
        CONFIRM = "confirm", "Confirm"
        DISPUTE = "dispute", "Dispute"
        REJECT = "reject", "Reject"

    attribute_row_id = models.PositiveIntegerField()
    attribute_table = models.CharField(max_length=20, choices=AttributeTable.choices)
    verified_by = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=10, choices=Action.choices)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


# ---------------------------------------------------------------------------
# Module 4: Images (stored in DB per project decision)
# ---------------------------------------------------------------------------

class Image(models.Model):
    class EntityType(models.TextChoices):
        PLACE = "place", "Place"
        ACCESS_POINT = "access_point", "Access point"
        FACILITY = "facility", "Facility"

    entity_type = models.CharField(max_length=20, choices=EntityType.choices)
    entity_id = models.PositiveIntegerField()
    image_data = models.BinaryField()
    content_type = models.CharField(max_length=30)
    file_size_bytes = models.PositiveIntegerField()
    thumbnail_data = models.BinaryField(null=True, blank=True)
    caption = models.CharField(max_length=255, blank=True)
    alt_text = models.CharField(max_length=255)  # required - WCAG compliance
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    verification_status = models.CharField(
        max_length=10,
        choices=[("pending", "Pending"), ("verified", "Verified"),
                  ("flagged", "Flagged"), ("removed", "Removed")],
        default="pending",
    )
    flagged_reason = models.TextField(blank=True)

    def __str__(self):
        return f"Image for {self.entity_type} #{self.entity_id}"


class SystemConfig(models.Model):
    """Tunable thresholds (image caps, verification threshold, staleness window, etc.)."""
    config_key = models.CharField(max_length=100, unique=True)
    config_value = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.config_key


# ---------------------------------------------------------------------------
# Indoor Navigation (scoped to work per-building; not every Place needs one)
#
# Rather than live indoor positioning (which needs beacon/WiFi infrastructure
# installed in every building - out of scope), a floor is modeled as a small
# waypoint graph, like a simplified subway map. The user tells the app where
# they're starting from (manual tap on the floor plan for now; QR-code
# checkpoint scanning is a planned follow-up that only changes how the
# starting waypoint gets set, not the pathfinding underneath). Pathfinding
# then runs over WaypointEdges using the same soft-filter philosophy as the
# street-level routing module - a route is always returned, with
# non-accessible segments flagged rather than excluded.
# ---------------------------------------------------------------------------

class FloorPlan(models.Model):
    """One floor's plan image for a Place. A Place may have zero or several."""
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="floor_plans")
    floor_level = models.CharField(max_length=20)  # e.g. "Ground", "2nd Floor" - matches Facility.floor_level
    image_data = models.BinaryField()   # stored in DB, consistent with the Image model's approach
    content_type = models.CharField(max_length=30)
    width_px = models.PositiveIntegerField()
    height_px = models.PositiveIntegerField()
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("place", "floor_level")

    def __str__(self):
        return f"{self.place.name} - {self.floor_level} floor plan"


class Waypoint(models.Model):
    """A navigable point on a floor plan: an entrance, elevator, ramp, junction, or facility."""

    class WaypointType(models.TextChoices):
        ENTRANCE = "entrance", "Entrance"
        ELEVATOR = "elevator", "Elevator"
        RAMP = "ramp", "Ramp"
        STAIRS = "stairs", "Stairs"
        JUNCTION = "junction", "Junction"
        FACILITY = "facility", "Facility"

    floor_plan = models.ForeignKey(FloorPlan, on_delete=models.CASCADE, related_name="waypoints")
    label = models.CharField(max_length=100)  # e.g. "Elevator Lobby", "Accessible Restroom"
    waypoint_type = models.CharField(max_length=20, choices=WaypointType.choices)
    x = models.PositiveIntegerField()  # pixel position on the floor plan image
    y = models.PositiveIntegerField()

    # Link back to existing accessibility data instead of duplicating it -
    # a waypoint for "2nd floor restroom" points at the real Facility row,
    # so its verified attributes/photos stay in one place.
    linked_facility = models.ForeignKey(
        Facility, on_delete=models.SET_NULL, null=True, blank=True, related_name="waypoints"
    )
    linked_access_point = models.ForeignKey(
        AccessPoint, on_delete=models.SET_NULL, null=True, blank=True, related_name="waypoints"
    )
    # QR checkpoint support (follow-up feature) - a code can be printed and
    # scanned to auto-set this waypoint as "you are here" without needing to
    # tap the floor plan manually.
    qr_code_value = models.CharField(max_length=100, unique=True, null=True, blank=True)

    def __str__(self):
        return f"{self.floor_plan} - {self.label}"


class WaypointEdge(models.Model):
    """A walkable connection between two waypoints on the same floor."""

    class PathType(models.TextChoices):
        CORRIDOR = "corridor", "Corridor"
        RAMP = "ramp", "Ramp"
        STAIRS = "stairs", "Stairs"
        ELEVATOR_SHAFT = "elevator_shaft", "Elevator (between floors)"

    floor_plan = models.ForeignKey(FloorPlan, on_delete=models.CASCADE, related_name="edges")
    from_waypoint = models.ForeignKey(Waypoint, on_delete=models.CASCADE, related_name="edges_from")
    to_waypoint = models.ForeignKey(Waypoint, on_delete=models.CASCADE, related_name="edges_to")
    distance_meters = models.DecimalField(max_digits=6, decimal_places=2, default=1)
    path_type = models.CharField(max_length=20, choices=PathType.choices, default=PathType.CORRIDOR)
    is_accessible = models.BooleanField(default=True)  # False for stairs-only segments
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.from_waypoint.label} -> {self.to_waypoint.label}"


class VerticalConnection(models.Model):
    """
    Links a lift or staircase waypoint on one floor to its counterpart on an
    adjacent floor. WaypointEdge is deliberately scoped to a single floor
    plan (it represents walking within a floor); this model represents
    moving BETWEEN floors, since a place can have several floor plans and
    routing needs to be able to cross from one to another (e.g. "route me
    from the Ground Floor entrance to the First Floor library").
    """

    class ConnectionType(models.TextChoices):
        ELEVATOR = "elevator", "Elevator"
        STAIRS = "stairs", "Stairs"
        RAMP = "ramp", "Ramp"

    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="vertical_connections")
    from_waypoint = models.ForeignKey(Waypoint, on_delete=models.CASCADE, related_name="vertical_edges_from")
    to_waypoint = models.ForeignKey(Waypoint, on_delete=models.CASCADE, related_name="vertical_edges_to")
    connection_type = models.CharField(max_length=20, choices=ConnectionType.choices)
    # "Distance" here is really a time/effort proxy for taking the lift/stairs
    # one level, not a walking distance - kept in the same unit so it can be
    # summed alongside WaypointEdge distances in the combined route graph.
    distance_meters = models.DecimalField(max_digits=6, decimal_places=2, default=5)
    is_accessible = models.BooleanField(default=True)  # False for stairs-only connections
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.from_waypoint} <-> {self.to_waypoint} ({self.connection_type})"
