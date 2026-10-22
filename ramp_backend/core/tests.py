from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import (
    AccessPoint, AccessPointAttribute, AttributeDefinition,
    Facility, FacilityAttribute, FacilityType, Place, PlaceCategory,
    PlaceReview, PlaceReviewHelpful, SavedPlace, User, VerificationStatus,
)


class RampFeaturesTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="tester",
            email="tester@example.com",
            password="testpassword123",
            reputation_score=20,
        )
        self.other_user = User.objects.create_user(
            username="contributor2",
            email="c2@example.com",
            password="testpassword123",
            reputation_score=15,
        )
        self.category = PlaceCategory.objects.create(name="Public Library")
        self.facility_type_restroom = FacilityType.objects.create(name="Restroom")
        self.facility_type_elevator = FacilityType.objects.create(name="Elevator")

        self.place = Place.objects.create(
            name="City Central Library",
            category=self.category,
            primary_location=Point(76.2673, 9.9312, srid=4326),
            address="Park Avenue, Kochi",
            city="Kochi",
            added_by=self.user,
        )

        self.ap = AccessPoint.objects.create(
            place=self.place,
            label="Main Entrance",
            location=Point(76.2673, 9.9312, srid=4326),
            is_accessible=True,
            is_primary_accessible_entrance=True,
        )

        self.facility = Facility.objects.create(
            place=self.place,
            facility_type=self.facility_type_restroom,
            floor_level="Ground",
            is_accessible=True,
        )

        self.attr_def = AttributeDefinition.objects.create(
            name="Ramp Gradient",
            applies_to="access_point",
            data_type="number",
            unit="degrees",
        )

        from .views import update_place_accessibility_score
        update_place_accessibility_score(self.place)
        self.place.refresh_from_db()

    def test_score_breakdown_transparency(self):
        """Feature 1: Test score breakdown endpoint returns all three pillars and recommendations."""
        res = self.client.get(f"/api/places/{self.place.id}/score/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertIn("overall_accessibility_score", data)
        self.assertIn("entrance", data)
        self.assertIn("attributes", data)
        self.assertIn("facilities", data)
        self.assertIn("recommendations", data)

        self.assertEqual(data["entrance"]["max"], 35)
        self.assertEqual(data["attributes"]["max"], 50)
        self.assertEqual(data["facilities"]["max"], 15)
        self.assertTrue(data["entrance"]["has_primary"])
        self.assertEqual(data["entrance"]["score"], 35.0)

    def test_advanced_places_filtering(self):
        """Feature 2: Test advanced filters (has_accessible_entrance, has_accessible_restroom, min_score, sort_by)."""
        # Place 2 without accessible amenities
        p2 = Place.objects.create(
            name="Historical Monument",
            category=self.category,
            primary_location=Point(76.27, 9.94, srid=4326),
            city="Kochi",
            overall_accessibility_score=10.0,
        )

        # Filter by has_accessible_entrance=true
        res = self.client.get("/api/places/?has_accessible_entrance=true")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", res.data)
        ids = [p["id"] for p in results]
        self.assertIn(self.place.id, ids)
        self.assertNotIn(p2.id, ids)

        # Filter by has_accessible_restroom=true
        res_restroom = self.client.get("/api/places/?has_accessible_restroom=true")
        self.assertEqual(res_restroom.status_code, status.HTTP_200_OK)
        results_restroom = res_restroom.data.get("results", res_restroom.data)
        ids_restroom = [p["id"] for p in results_restroom]
        self.assertIn(self.place.id, ids_restroom)

        # Filter by min_score
        res_min = self.client.get("/api/places/?min_score=30")
        results_min = res_min.data.get("results", res_min.data)
        ids_min = [p["id"] for p in results_min]
        self.assertIn(self.place.id, ids_min)
        self.assertNotIn(p2.id, ids_min)

    def test_add_access_point_and_facility_attributes(self):
        """Feature 3: Test adding access entrance and verifying facility attributes."""
        self.client.force_authenticate(user=self.user)

        # 1. Add another entrance
        ap_res = self.client.post(
            f"/api/places/{self.place.id}/access-points/",
            {
                "label": "Rear Ramp Entrance",
                "location": {"lat": 9.9315, "lng": 76.2675},
                "is_accessible": True,
                "notes": "Direct access to elevator",
            },
            format="json",
        )
        self.assertEqual(ap_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.place.access_points.count(), 2)

        # 2. Add attribute definition for facility
        fac_attr_def = AttributeDefinition.objects.create(
            name="Grab Bars Available",
            applies_to="facility",
            data_type="boolean",
        )

        # 3. Submit facility attribute
        attr_res = self.client.post(
            f"/api/places/{self.place.id}/facilities/{self.facility.id}/attributes/",
            {
                "attribute_definition": fac_attr_def.id,
                "value_boolean": True,
            },
        )
        self.assertEqual(attr_res.status_code, status.HTTP_201_CREATED)
        attr_id = attr_res.data["id"]

        # 4. Peer user confirms facility attribute
        self.client.force_authenticate(user=self.other_user)
        initial_rep = self.other_user.reputation_score
        verify_res = self.client.post(
            f"/api/places/{self.place.id}/facilities/{self.facility.id}/attributes/{attr_id}/verify/",
            {"action": "confirm"},
        )
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        self.other_user.refresh_from_db()
        # +2 for peer verification + 5 bonus for unlocking first-verification badge
        self.assertEqual(self.other_user.reputation_score, initial_rep + 2 + 5)

    def test_community_reviews_and_ratings(self):
        """Feature 4: Test creating review, awarding reputation (+5), helpful voting, and stats."""
        self.client.force_authenticate(user=self.user)
        initial_rep = self.user.reputation_score

        # 1. Create review
        review_res = self.client.post(
            f"/api/places/{self.place.id}/reviews/",
            {
                "rating": 5,
                "title": "Super smooth entrance ramp",
                "review_text": "Easily navigated with power wheelchair. Restroom is very spacious.",
                "tags": ["Smooth ramp", "Spacious restroom"],
            },
            format="json",
        )
        self.assertEqual(review_res.status_code, status.HTTP_201_CREATED)
        review_id = review_res.data["id"]

        # Reputation check (+5 points awarded for review, +5 for first-place-mapped badge)
        self.user.refresh_from_db()
        self.assertEqual(self.user.reputation_score, initial_rep + 5 + 5)

        # 2. Other user votes review helpful
        self.client.force_authenticate(user=self.other_user)
        helpful_res = self.client.post(f"/api/places/{self.place.id}/reviews/{review_id}/helpful/")
        self.assertEqual(helpful_res.status_code, status.HTTP_200_OK)
        self.assertEqual(helpful_res.data["helpful_count"], 1)
        self.assertTrue(helpful_res.data["has_voted_helpful"])

        # 3. Check review stats
        stats_res = self.client.get(f"/api/places/{self.place.id}/reviews/stats/")
        self.assertEqual(stats_res.status_code, status.HTTP_200_OK)
        self.assertEqual(stats_res.data["total_reviews"], 1)
        distribution = stats_res.data["rating_distribution"]
        five_star_count = distribution.get(5, distribution.get("5", 0))
        self.assertEqual(five_star_count, 1)

    def test_saved_places_bookmarks(self):
        """Feature 5: Test saving place, listing saved places, and removing bookmarks."""
        self.client.force_authenticate(user=self.user)

        # 1. Bookmark via toggle endpoint
        bm_res = self.client.post(
            f"/api/places/{self.place.id}/bookmark/",
            {"notes": "Enter via south ramp"},
        )
        self.assertEqual(bm_res.status_code, status.HTTP_200_OK)
        self.assertTrue(bm_res.data["is_saved"])
        self.assertTrue(SavedPlace.objects.filter(user=self.user, place=self.place).exists())

        # 2. Check saved places list
        saved_list = self.client.get("/api/auth/saved-places/")
        self.assertEqual(saved_list.status_code, status.HTTP_200_OK)
        results = saved_list.data.get("results", saved_list.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["place"]["id"], self.place.id)
        self.assertEqual(results[0]["notes"], "Enter via south ramp")

        # 3. Remove bookmark
        del_res = self.client.delete(f"/api/places/{self.place.id}/bookmark/")
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.assertFalse(del_res.data["is_saved"])
        self.assertFalse(SavedPlace.objects.filter(user=self.user, place=self.place).exists())
