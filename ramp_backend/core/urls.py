from django.urls import include, path
from rest_framework_nested import routers

from . import views

router = routers.DefaultRouter()
router.register("places", views.PlaceViewSet, basename="place")
router.register("place-categories", views.PlaceCategoryViewSet, basename="place-category")
router.register("facility-types", views.FacilityTypeViewSet, basename="facility-type")
router.register("attribute-definitions", views.AttributeDefinitionViewSet, basename="attribute-definition")
router.register("images", views.ImageViewSet, basename="image")

# /api/places/{place_pk}/access-points/
places_router = routers.NestedDefaultRouter(router, "places", lookup="place")
places_router.register("access-points", views.AccessPointViewSet, basename="place-access-points")
places_router.register("facilities", views.FacilityViewSet, basename="place-facilities")

# /api/places/{place_pk}/access-points/{access_point_pk}/attributes/
access_points_router = routers.NestedDefaultRouter(places_router, "access-points", lookup="access_point")
access_points_router.register(
    "attributes", views.AccessPointAttributeViewSet, basename="access-point-attributes"
)

# /api/places/{place_pk}/facilities/{facility_pk}/attributes/
facilities_router = routers.NestedDefaultRouter(places_router, "facilities", lookup="facility")
facilities_router.register(
    "attributes", views.FacilityAttributeViewSet, basename="facility-attributes"
)

# /api/admin/* — staff-only management endpoints
admin_router = routers.DefaultRouter()
admin_router.register("users", views.AdminUserViewSet, basename="admin-user")
admin_router.register("venues", views.AdminVenueOwnerViewSet, basename="admin-venue")
admin_router.register("places", views.AdminPlaceViewSet, basename="admin-place")
admin_router.register("place-categories", views.AdminPlaceCategoryViewSet, basename="admin-place-category")
admin_router.register("facility-types", views.AdminFacilityTypeViewSet, basename="admin-facility-type")
admin_router.register("accessibility-profiles", views.AdminAccessibilityProfileViewSet, basename="admin-accessibility-profile")
admin_router.register("attribute-definitions", views.AdminAttributeDefinitionViewSet, basename="admin-attribute-definition")
admin_router.register("attribute-verifications", views.AdminAttributeVerificationViewSet, basename="admin-attribute-verification")
admin_router.register("images", views.AdminImageViewSet, basename="admin-image")
admin_router.register("system-config", views.AdminSystemConfigViewSet, basename="admin-system-config")

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/refresh/", views.RefreshView.as_view(), name="refresh"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("auth/change-password/", views.ChangePasswordView.as_view(), name="change-password"),
    path("auth/my-places/", views.MyPlacesView.as_view(), name="my-places"),
    path("auth/my-attributes/", views.MyAttributesView.as_view(), name="my-attributes"),

    path("images/<int:pk>/file/", views.ImageFileView.as_view(), name="image-file"),
    path("images/<int:pk>/thumb/", views.ImageThumbView.as_view(), name="image-thumb"),

    # Gamification, badges, milestones & leaderboards
    path("badges/", views.BadgesListView.as_view(), name="badges-list"),
    path("badges/my/", views.MyBadgesView.as_view(), name="my-badges"),
    path("badges/milestones/", views.ContributionMilestonesView.as_view(), name="badges-milestones"),
    path("badges/tiers/", views.RewardTiersView.as_view(), name="badges-tiers"),
    path("leaderboard/", views.LeaderboardView.as_view(), name="leaderboard"),

    # Nearby places for duplicate-building detection (before submission).
    # Must be declared before the router include to avoid conflict with /places/{pk}/.
    path("places/nearby/", views.NearbyPlacesView.as_view(), name="places-nearby"),

    path("", include(router.urls)),
    path("", include(places_router.urls)),
    path("", include(access_points_router.urls)),
    path("", include(facilities_router.urls)),

    # Admin endpoints
    path("admin/stats/", views.AdminStatsView.as_view(), name="admin-stats"),
    path("admin/", include(admin_router.urls)),
]
