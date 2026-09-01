"""
Seeds RAMP's Place and AccessPoint tables from OpenStreetMap's crowdsourced
wheelchair-accessibility tags (the same tags Wheelmap.org is built on).

This solves the "cold start" problem: a brand-new city on RAMP starts with
zero data. OSM already has some `wheelchair=yes/no/limited` tagged nodes
almost everywhere, so we import those as a starting point.

IMPORTANT — nothing imported here is treated as verified truth:
  - AccessPoint.notes is stamped with an "Imported from OpenStreetMap"
    disclaimer so it's visually obvious in the UI that this needs a
    real-world confirmation.
  - We deliberately do NOT create AccessPointAttribute rows with
    verification_status=verified — OSM data can be stale or wrong, so it
    enters the same pending/community-verification pipeline as any other
    submission, just pre-populated instead of starting from a blank map.

Usage:
    python manage.py seed_from_osm --city "Kochi, India" --limit 200
    python manage.py seed_from_osm --city "Kochi, India" --dry-run
"""
import time

import requests
from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError

from core.models import AccessPoint, Place, PlaceCategory, User

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Best-effort mapping from OSM tags to RAMP's PlaceCategory names.
# Falls back to "Other" (created if missing) when nothing matches.
OSM_TAG_TO_CATEGORY = {
    ("amenity", "restaurant"): "Restaurant",
    ("amenity", "cafe"): "Restaurant",
    ("amenity", "fast_food"): "Restaurant",
    ("amenity", "hospital"): "Hospital",
    ("amenity", "clinic"): "Hospital",
    ("amenity", "school"): "School",
    ("amenity", "college"): "School",
    ("amenity", "university"): "School",
    ("amenity", "cinema"): "Cinema",
    ("amenity", "townhall"): "Government Office",
    ("office", "government"): "Government Office",
    ("leisure", "park"): "Park",
    ("shop", "mall"): "Shopping Mall",
    ("shop", "supermarket"): "Shopping Mall",
    ("railway", "station"): "Transit Station",
    ("amenity", "bus_station"): "Transit Station",
    ("public_transport", "station"): "Transit Station",
}

WHEELCHAIR_VALUE_MAP = {
    "yes": True,
    "limited": False,  # partially accessible - conservatively marked not fully accessible
    "no": False,
}


class Command(BaseCommand):
    help = "Seed Places/AccessPoints from OpenStreetMap wheelchair-accessibility tags for a given city."

    def add_arguments(self, parser):
        parser.add_argument("--city", required=True, help='City name, e.g. "Kochi, India"')
        parser.add_argument("--limit", type=int, default=200, help="Max nodes to import (default 200)")
        parser.add_argument("--dry-run", action="store_true", help="Preview without writing to the DB")

    def handle(self, *args, **options):
        city = options["city"]
        limit = options["limit"]
        dry_run = options["dry_run"]

        bbox = self._geocode_city(city)
        self.stdout.write(f"Bounding box for '{city}': {bbox}")

        elements = self._query_overpass(bbox, limit)
        self.stdout.write(f"OSM returned {len(elements)} wheelchair-tagged nodes.")

        if dry_run:
            for el in elements[:10]:
                tags = el.get("tags", {})
                self.stdout.write(f"  - {tags.get('name', '(unnamed)')} | wheelchair={tags.get('wheelchair')}")
            self.stdout.write(self.style.WARNING("Dry run - nothing written to the database."))
            return

        system_user, _ = User.objects.get_or_create(
            username="osm_import_bot",
            defaults={"email": "osm-import@ramp.local", "user_type": "individual"},
        )
        fallback_category, _ = PlaceCategory.objects.get_or_create(name="Other")

        created, skipped = 0, 0
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name")
            lat, lon = el.get("lat"), el.get("lon")
            if not name or lat is None or lon is None:
                skipped += 1
                continue

            # Skip if a place with this exact name already exists very close by -
            # cheap dedupe to avoid re-importing on repeated runs.
            if Place.objects.filter(name=name, city__iexact=city.split(",")[0].strip()).exists():
                skipped += 1
                continue

            category = self._map_category(tags, fallback_category)
            wheelchair_value = WHEELCHAIR_VALUE_MAP.get(tags.get("wheelchair"), False)

            place = Place.objects.create(
                name=name,
                category=category,
                primary_location=Point(lon, lat, srid=4326),
                address=tags.get("addr:full", "") or tags.get("addr:street", ""),
                city=city.split(",")[0].strip(),
                added_by=system_user,
            )
            AccessPoint.objects.create(
                place=place,
                label="Main Entrance",
                location=Point(lon, lat, srid=4326),
                is_accessible=wheelchair_value,
                is_primary_accessible_entrance=wheelchair_value,
                notes=(
                    "Imported from OpenStreetMap (wheelchair="
                    f"{tags.get('wheelchair', 'unknown')}). Not yet confirmed by the "
                    "RAMP community - please verify if you've visited."
                ),
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done. Created {created} places, skipped {skipped} (missing data or already imported)."
        ))

    def _geocode_city(self, city):
        """Look up a rough bounding box for the city via Nominatim."""
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": city, "format": "json", "limit": 1},
            headers={"User-Agent": "RAMP-accessibility-platform/1.0"},
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json()
        if not results:
            raise CommandError(f"Could not geocode city: {city}")
        bbox = results[0]["boundingbox"]  # [south, north, west, east] as strings
        return [float(x) for x in bbox]

    def _query_overpass(self, bbox, limit):
        """Query Overpass for nodes with a wheelchair=* tag inside the bounding box."""
        south, north, west, east = bbox
        query = f"""
        [out:json][timeout:60];
        node["wheelchair"]["name"]({south},{west},{north},{east});
        out body {limit};
        """
        for attempt in range(3):
            resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=90)
            if resp.status_code == 200:
                return resp.json().get("elements", [])
            time.sleep(5)  # Overpass rate-limits aggressively; back off and retry
        raise CommandError("Overpass API did not respond successfully after 3 attempts.")

    def _map_category(self, tags, fallback):
        for (key, value), category_name in OSM_TAG_TO_CATEGORY.items():
            if tags.get(key) == value:
                category, _ = PlaceCategory.objects.get_or_create(name=category_name)
                return category
        return fallback
