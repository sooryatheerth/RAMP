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
    AttributeVerification, Facility, FacilityAttribute, FloorPlan, Image,
    Place, PlaceCategory, User, VerificationStatus, VerticalConnection,
    Waypoint, WaypointEdge,
)
from .permissions import CanVerifySubmissions, IsOwnerOrReadOnly
from .serializers import (
    AccessPointAttributeSerializer, AccessPointSerializer,
    AttributeDefinitionSerializer, FacilityAttributeSerializer,
    FacilitySerializer, FloorPlanMetaSerializer, FloorPlanUploadSerializer,
    ImageMetaSerializer, ImageUploadSerializer, PlaceCategorySerializer,
    PlaceDetailSerializer, PlaceListSerializer, PlaceRouteRequestSerializer,
    RegisterSerializer, UserSerializer, VerticalConnectionSerializer,
    WaypointEdgeSerializer, WaypointScanResultSerializer, WaypointSerializer,
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
# Indoor Navigation
# ---------------------------------------------------------------------------

class FloorPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = FloorPlan.objects.all()
        place_id = self.kwargs.get("place_pk")
        if place_id:
            qs = qs.filter(place_id=place_id)
        return qs

    def get_serializer_class(self):
        return FloorPlanUploadSerializer if self.action == "create" else FloorPlanMetaSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["place_id"] = self.kwargs.get("place_pk")
        return ctx


class FloorPlanFileView(APIView):
    """Streams the floor plan image binary."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        floor_plan = FloorPlan.objects.get(pk=pk)
        return HttpResponse(bytes(floor_plan.image_data), content_type=floor_plan.content_type)


class WaypointViewSet(viewsets.ModelViewSet):
    serializer_class = WaypointSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Waypoint.objects.filter(floor_plan_id=self.kwargs["floor_plan_pk"])

    def perform_create(self, serializer):
        serializer.save(floor_plan_id=self.kwargs["floor_plan_pk"])


class WaypointEdgeViewSet(viewsets.ModelViewSet):
    serializer_class = WaypointEdgeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return WaypointEdge.objects.filter(floor_plan_id=self.kwargs["floor_plan_pk"])

    def perform_create(self, serializer):
        serializer.save(floor_plan_id=self.kwargs["floor_plan_pk"])


class WaypointScanView(APIView):
    """
    Checkpoint-based position tracking (Option A): looks up a waypoint by its
    QR code value and returns enough context (floor plan, place) for the
    frontend to set it as the user's "you are here" position. Also usable
    for manual tap-to-set, since the frontend already has waypoint ids from
    the floor plan viewer and can call the regular waypoint detail endpoint -
    this one specifically supports the "scan a physical QR sticker" flow.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, qr_code_value):
        try:
            waypoint = Waypoint.objects.select_related("floor_plan").get(
                qr_code_value=qr_code_value
            )
        except Waypoint.DoesNotExist:
            return Response(
                {"detail": "No waypoint matches this QR code."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(WaypointScanResultSerializer(waypoint).data)


class VerticalConnectionViewSet(viewsets.ModelViewSet):
    """Links waypoints across floors (e.g. Ground Floor Lift <-> First Floor Lift)."""
    serializer_class = VerticalConnectionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return VerticalConnection.objects.filter(place_id=self.kwargs["place_pk"])

    def perform_create(self, serializer):
        serializer.save(place_id=self.kwargs["place_pk"])


class PlaceRouteView(APIView):
    """
    Computes an accessible path between two waypoints ANYWHERE within a
    place - possibly on different floors. Combines WaypointEdges (walking
    within a floor) and VerticalConnections (moving between floors, via a
    lift or staircase) into one graph before running Dijkstra, so a route
    like "Ground Floor entrance -> First Floor library" works in a single
    call instead of the frontend having to stitch together several
    single-floor routes itself.

    Uses the same "soft filter" philosophy as the street-level routing
    module: a route is always returned if the graph is connected at all -
    non-accessible edges (stairs) are heavily penalized rather than excluded
    outright, and any such edges used are flagged in the response so the
    user can decide, rather than the app silently refusing to route them.
    """
    permission_classes = [permissions.AllowAny]

    # How much more "expensive" a non-accessible edge is treated as, when
    # require_accessible=True. High enough that any accessible detour is
    # preferred, but finite so a route is still found if it's the only path.
    INACCESSIBLE_PENALTY_MULTIPLIER = 25

    def post(self, request, place_pk, **kwargs):
        serializer = PlaceRouteRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        graph = {}

        # Within-floor edges
        floor_edges = WaypointEdge.objects.filter(floor_plan__place_id=place_pk)
        for edge in floor_edges:
            weight = float(edge.distance_meters)
            if data["require_accessible"] and not edge.is_accessible:
                weight *= self.INACCESSIBLE_PENALTY_MULTIPLIER
            graph.setdefault(edge.from_waypoint_id, []).append((edge.to_waypoint_id, weight, edge, "floor"))
            graph.setdefault(edge.to_waypoint_id, []).append((edge.from_waypoint_id, weight, edge, "floor"))

        # Between-floor connections (lift/stairs)
        vertical_edges = VerticalConnection.objects.filter(place_id=place_pk)
        for edge in vertical_edges:
            weight = float(edge.distance_meters)
            if data["require_accessible"] and not edge.is_accessible:
                weight *= self.INACCESSIBLE_PENALTY_MULTIPLIER
            graph.setdefault(edge.from_waypoint_id, []).append((edge.to_waypoint_id, weight, edge, "vertical"))
            graph.setdefault(edge.to_waypoint_id, []).append((edge.from_waypoint_id, weight, edge, "vertical"))

        path_waypoint_ids, path_edges, total_distance = self._dijkstra(
            graph, data["from_waypoint"], data["to_waypoint"]
        )

        if path_waypoint_ids is None:
            return Response(
                {"detail": "No path found between these waypoints in this place."},
                status=status.HTTP_404_NOT_FOUND,
            )

        warnings = []
        for edge, edge_kind in path_edges:
            if not edge.is_accessible:
                if edge_kind == "floor":
                    label = edge.get_path_type_display()
                else:
                    label = edge.get_connection_type_display()
                warnings.append({
                    "edge_id": edge.id,
                    "edge_kind": edge_kind,
                    "from": edge.from_waypoint.label,
                    "to": edge.to_waypoint.label,
                    "issue": f"This segment is not marked accessible ({label}).",
                })

        waypoints = Waypoint.objects.filter(id__in=path_waypoint_ids)
        waypoints_by_id = {w.id: w for w in waypoints}
        ordered_waypoints = [waypoints_by_id[wid] for wid in path_waypoint_ids]

        confidence = 100 if not warnings else max(0, 100 - len(warnings) * 30)

        return Response({
            "path": WaypointSerializer(ordered_waypoints, many=True).data,
            "total_distance_meters": round(sum(float(e.distance_meters) for e, _ in path_edges), 2),
            "warnings": warnings,
            "accessibility_confidence_score": confidence,
            "crosses_floors": len({w.floor_plan_id for w in ordered_waypoints}) > 1,
        })

    @staticmethod
    def _dijkstra(graph, start_id, end_id):
        """Standard Dijkstra over the in-memory adjacency dict built above."""
        import heapq

        if start_id not in graph or end_id not in graph:
            return None, None, None

        distances = {start_id: 0}
        previous = {}
        previous_edge = {}
        visited = set()
        queue = [(0, start_id)]

        while queue:
            dist, node = heapq.heappop(queue)
            if node in visited:
                continue
            visited.add(node)
            if node == end_id:
                break
            for neighbor, weight, edge, edge_kind in graph.get(node, []):
                new_dist = dist + weight
                if neighbor not in distances or new_dist < distances[neighbor]:
                    distances[neighbor] = new_dist
                    previous[neighbor] = node
                    previous_edge[neighbor] = (edge, edge_kind)
                    heapq.heappush(queue, (new_dist, neighbor))

        if end_id not in previous and end_id != start_id:
            return None, None, None

        # Reconstruct path from end back to start
        path_ids = [end_id]
        path_edges = []
        current = end_id
        while current != start_id:
            path_edges.append(previous_edge[current])
            current = previous[current]
            path_ids.append(current)
        path_ids.reverse()
        path_edges.reverse()

        return path_ids, path_edges, distances[end_id]
