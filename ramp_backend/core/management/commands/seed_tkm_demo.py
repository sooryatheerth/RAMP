"""
Seeds a real, working indoor-navigation demo: TKM College of Engineering -
Main Block, Ground Floor, using the actual floor plan drawing supplied for
the project. This exists so anyone pulling the repo gets the same demo data
that was used to build and test the indoor navigation feature, rather than
an empty database where "Navigate inside" never appears because no place
has a floor plan yet.

Usage:
    python manage.py seed_tkm_demo
    python manage.py seed_tkm_demo --reset   (deletes and recreates it)

Waypoint pixel coordinates were read directly off the 2482x1755px rendering
of MAIN_BLOCK_GF.pdf at 150 DPI (the same image shipped alongside this
command in data/tkm_main_block_gf.png) - see the project diary / chat
history for how each coordinate was identified (Porch, courtyard Lift,
staircase, Civil Library).
"""
import os

from django.core.management.base import BaseCommand

from core.models import (
    AccessPoint, FloorPlan, Place, PlaceCategory, User, Waypoint, WaypointEdge,
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
FLOOR_PLAN_IMAGE = os.path.join(DATA_DIR, "tkm_main_block_gf.png")

PLACE_NAME = "TKM College of Engineering - Main Block"


class Command(BaseCommand):
    help = "Seed the real TKM College Main Block indoor navigation demo (place, floor plan, waypoints, edges)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true",
            help="Delete the existing TKM Main Block demo place (and everything under it) before recreating it.",
        )

    def handle(self, *args, **options):
        if options["reset"]:
            deleted, _ = Place.objects.filter(name=PLACE_NAME).delete()
            if deleted:
                self.stdout.write(self.style.WARNING(f"Removed existing '{PLACE_NAME}' and related data."))

        if Place.objects.filter(name=PLACE_NAME).exists():
            self.stdout.write(self.style.WARNING(
                f"'{PLACE_NAME}' already exists - skipping. Use --reset to recreate it."
            ))
            return

        if not os.path.exists(FLOOR_PLAN_IMAGE):
            self.stderr.write(self.style.ERROR(f"Floor plan image not found at {FLOOR_PLAN_IMAGE}"))
            return

        system_user, _ = User.objects.get_or_create(
            username="ramp_demo_seed",
            defaults={"email": "demo-seed@ramp.local", "user_type": "individual"},
        )

        category, _ = PlaceCategory.objects.get_or_create(name="School")

        from django.contrib.gis.geos import Point
        place = Place.objects.create(
            name=PLACE_NAME,
            category=category,
            description=(
                "The main academic building at TKM College of Engineering, Kollam - "
                "houses the library, administration offices, and lecture halls."
            ),
            address="TKM College of Engineering, Kollam",
            city="Kollam",
            # Approximate coordinates - replace with surveyed GPS if precision matters.
            primary_location=Point(76.6141, 8.8932, srid=4326),
            added_by=system_user,
        )
        self.stdout.write(f"Created place: {place.name} (id={place.id})")

        with open(FLOOR_PLAN_IMAGE, "rb") as f:
            image_bytes = f.read()
        from PIL import Image as PILImage
        import io
        width, height = PILImage.open(io.BytesIO(image_bytes)).size

        floor_plan = FloorPlan.objects.create(
            place=place,
            floor_level="Ground",
            image_data=image_bytes,
            content_type="image/png",
            width_px=width,
            height_px=height,
            uploaded_by=system_user,
        )
        self.stdout.write(f"Created floor plan: {floor_plan.floor_level} ({width}x{height}px)")

        # Waypoints - pixel coordinates read directly off the drawing.
        entrance = Waypoint.objects.create(
            floor_plan=floor_plan, label="Main Entrance (Porch)",
            waypoint_type="entrance", x=1255, y=1130,
        )
        lobby = Waypoint.objects.create(
            floor_plan=floor_plan, label="Lobby (Courtyard Junction)",
            waypoint_type="junction", x=1250, y=980,
        )
        lift = Waypoint.objects.create(
            floor_plan=floor_plan, label="Lift",
            waypoint_type="elevator", x=1230, y=855,
            qr_code_value="TKM-MAIN-GF-LIFT",
        )
        stairs = Waypoint.objects.create(
            floor_plan=floor_plan, label="Staircase (near Lift)",
            waypoint_type="stairs", x=1230, y=925,
        )
        library = Waypoint.objects.create(
            floor_plan=floor_plan, label="Civil Library (Room 119)",
            waypoint_type="facility", x=1120, y=1005,
        )
        self.stdout.write(f"Created 5 waypoints (entrance={entrance.id}, lobby={lobby.id}, "
                           f"lift={lift.id}, stairs={stairs.id}, library={library.id})")

        # Edges - distances are estimated from the drawing's room dimensions,
        # not precisely measured; adjust if you survey the real building.
        WaypointEdge.objects.create(
            floor_plan=floor_plan, from_waypoint=entrance, to_waypoint=lobby,
            distance_meters=15, path_type="corridor", is_accessible=True,
            notes="Level porch and corridor into the main lobby",
        )
        WaypointEdge.objects.create(
            floor_plan=floor_plan, from_waypoint=lobby, to_waypoint=lift,
            distance_meters=8, path_type="corridor", is_accessible=True,
        )
        WaypointEdge.objects.create(
            floor_plan=floor_plan, from_waypoint=lobby, to_waypoint=stairs,
            distance_meters=6, path_type="stairs", is_accessible=False,
            notes="Staircase, no ramp on this run",
        )
        WaypointEdge.objects.create(
            floor_plan=floor_plan, from_waypoint=lobby, to_waypoint=library,
            distance_meters=12, path_type="corridor", is_accessible=True,
        )
        self.stdout.write("Created 4 edges connecting the waypoints")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Visit the place (id={place.id}) and click 'Navigate inside' to try it.\n"
            f"Try scanning/entering QR code 'TKM-MAIN-GF-LIFT' to check in at the Lift."
        ))
