from django.core.management.base import BaseCommand

from core.models import (
    AccessibilityProfile, AttributeDefinition, FacilityType, PlaceCategory,
)


class Command(BaseCommand):
    help = "Seed RAMP lookup tables (categories, facility types, attribute definitions, accessibility profiles)."

    def handle(self, *args, **options):
        self._seed_accessibility_profiles()
        self._seed_place_categories()
        self._seed_facility_types()
        self._seed_attribute_definitions()
        self.stdout.write(self.style.SUCCESS("RAMP lookup tables seeded."))

    def _seed_accessibility_profiles(self):
        profiles = [
            ("wheelchair", "Wheelchair user"),
            ("visual", "Visually impaired"),
            ("hearing", "Hearing impaired"),
            ("elderly", "Elderly / limited stamina"),
            ("temporary", "Temporary mobility challenge"),
        ]
        for code, label in profiles:
            AccessibilityProfile.objects.get_or_create(code=code, defaults={"label": label})

    def _seed_place_categories(self):
        categories = [
            "Restaurant", "Hospital", "Park", "Transit Station",
            "Government Office", "Shopping Mall", "School", "Cinema",
        ]
        for name in categories:
            PlaceCategory.objects.get_or_create(name=name)

    def _seed_facility_types(self):
        types = [
            "Restroom", "Elevator", "Parking", "Ramp",
            "Tactile Path", "Braille Signage",
        ]
        for name in types:
            FacilityType.objects.get_or_create(name=name)

    def _seed_attribute_definitions(self):
        restroom = FacilityType.objects.get(name="Restroom")
        elevator = FacilityType.objects.get(name="Elevator")
        parking = FacilityType.objects.get(name="Parking")
        tactile = FacilityType.objects.get(name="Tactile Path")

        definitions = [
            # Access point attributes
            dict(applies_to="access_point", facility_type=None, name="Ramp Gradient",
                 data_type="number", unit="degrees", is_required=False),
            dict(applies_to="access_point", facility_type=None, name="Door Width",
                 data_type="number", unit="cm", is_required=False),
            dict(applies_to="access_point", facility_type=None, name="Handrail Present",
                 data_type="boolean", unit="", is_required=False),
            dict(applies_to="access_point", facility_type=None, name="Step Count",
                 data_type="number", unit="steps", is_required=False),
            # Facility attributes
            dict(applies_to="facility", facility_type=restroom, name="Stall Width",
                 data_type="number", unit="cm", is_required=False),
            dict(applies_to="facility", facility_type=restroom, name="Grab Bars Present",
                 data_type="boolean", unit="", is_required=False),
            dict(applies_to="facility", facility_type=elevator, name="Braille Buttons",
                 data_type="boolean", unit="", is_required=False),
            dict(applies_to="facility", facility_type=elevator, name="Audio Announcement",
                 data_type="boolean", unit="", is_required=False),
            dict(applies_to="facility", facility_type=parking, name="Distance to Entrance",
                 data_type="number", unit="meters", is_required=False),
            dict(applies_to="facility", facility_type=tactile, name="Path Continuity",
                 data_type="choice", unit="",
                 choice_options=["continuous", "broken", "absent"], is_required=False),
        ]
        for d in definitions:
            AttributeDefinition.objects.get_or_create(
                applies_to=d["applies_to"], facility_type=d["facility_type"], name=d["name"],
                defaults={
                    "data_type": d["data_type"],
                    "unit": d["unit"],
                    "is_required": d["is_required"],
                    "choice_options": d.get("choice_options"),
                },
            )
