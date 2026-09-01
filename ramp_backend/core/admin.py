from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    AccessibilityProfile, AccessPoint, AccessPointAttribute,
    AttributeDefinition, AttributeVerification, Facility,
    FacilityAttribute, FacilityType, Image, Place, PlaceCategory,
    SystemConfig, User, UserAccessibilityProfile, VenueOwnerProfile,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "email", "user_type", "reputation_score", "is_verified_email"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("RAMP", {"fields": ("user_type", "reputation_score", "is_verified_email")}),
    )


admin.site.register(AccessibilityProfile)
admin.site.register(UserAccessibilityProfile)
admin.site.register(VenueOwnerProfile)
admin.site.register(PlaceCategory)
admin.site.register(Place)
admin.site.register(AccessPoint)
admin.site.register(FacilityType)
admin.site.register(Facility)
admin.site.register(AttributeDefinition)
admin.site.register(AccessPointAttribute)
admin.site.register(FacilityAttribute)
admin.site.register(AttributeVerification)
admin.site.register(Image)
admin.site.register(SystemConfig)
