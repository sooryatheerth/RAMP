from django.urls import include, path
from rest_framework_nested import routers

from . import views

router = routers.DefaultRouter()
router.register("places", views.PlaceViewSet, basename="place")
router.register("place-categories", views.PlaceCategoryViewSet, basename="place-category")
router.register("attribute-definitions", views.AttributeDefinitionViewSet, basename="attribute-definition")
router.register("images", views.ImageViewSet, basename="image")

# /api/places/{place_pk}/access-points/
places_router = routers.NestedDefaultRouter(router, "places", lookup="place")
places_router.register("access-points", views.AccessPointViewSet, basename="place-access-points")
places_router.register("facilities", views.FacilityViewSet, basename="place-facilities")
places_router.register("floor-plans", views.FloorPlanViewSet, basename="place-floor-plans")

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

# /api/places/{place_pk}/floor-plans/{floor_plan_pk}/waypoints/  and  /edges/
floor_plans_router = routers.NestedDefaultRouter(places_router, "floor-plans", lookup="floor_plan")
floor_plans_router.register("waypoints", views.WaypointViewSet, basename="floor-plan-waypoints")
floor_plans_router.register("edges", views.WaypointEdgeViewSet, basename="floor-plan-edges")

# /api/places/{place_pk}/vertical-connections/
places_router.register(
    "vertical-connections", views.VerticalConnectionViewSet, basename="place-vertical-connections"
)

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/refresh/", views.RefreshView.as_view(), name="refresh"),
    path("auth/me/", views.MeView.as_view(), name="me"),

    path("images/<int:pk>/file/", views.ImageFileView.as_view(), name="image-file"),
    path("images/<int:pk>/thumb/", views.ImageThumbView.as_view(), name="image-thumb"),
    path("floor-plans/<int:pk>/file/", views.FloorPlanFileView.as_view(), name="floor-plan-file"),
    path("waypoints/scan/<str:qr_code_value>/", views.WaypointScanView.as_view(), name="waypoint-scan"),
    path(
        "places/<int:place_pk>/route/",
        views.PlaceRouteView.as_view(),
        name="place-route",
    ),

    path("", include(router.urls)),
    path("", include(places_router.urls)),
    path("", include(access_points_router.urls)),
    path("", include(facilities_router.urls)),
    path("", include(floor_plans_router.urls)),
]
