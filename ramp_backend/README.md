# RAMP Backend (Django + DRF + PostGIS)

Scaffolded core module set: Users/Auth, Places, Access Points, Facilities,
Accessibility Attributes, Images (DB-stored). Reviews, Routing, Gamification,
Notifications, and Venue/API modules will be added as follow-up apps.

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Then, in another terminal:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py seed_ramp
```

API is now live at `http://localhost:8000/api/`
Admin panel at `http://localhost:8000/admin/`

## Quick start (without Docker)

Requires a local PostgreSQL with the PostGIS extension enabled, and GDAL installed.

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then edit DB_HOST=localhost, REDIS_URL=redis://localhost:6379/0
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_ramp
python manage.py runserver
```

## Key endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/register/` | POST | Create account |
| `/api/auth/login/` | POST | Get JWT access/refresh tokens |
| `/api/auth/me/` | GET/PATCH | Current user profile + accessibility profiles |
| `/api/places/` | GET/POST | List (filter: `?category=&city=&near=lat,lng&radius=km`) / create places |
| `/api/places/{id}/` | GET/PATCH | Place detail (nested access points + facilities) |
| `/api/places/{id}/score/` | GET | Accessibility score breakdown |
| `/api/places/{place_id}/access-points/` | GET/POST | Entrances for a place |
| `/api/places/{place_id}/access-points/{id}/attributes/` | GET/POST | Structured accessibility attributes |
| `/api/places/{place_id}/access-points/{id}/attributes/{id}/verify/` | POST | Confirm/dispute/reject a submission |
| `/api/places/{place_id}/facilities/` | GET/POST | Restrooms, elevators, parking, etc. |
| `/api/attribute-definitions/` | GET | Lookup for building submission forms |
| `/api/images/` | GET/POST | Upload/list images (multipart, enforces per-entity cap) |
| `/api/images/{id}/file/` | GET | Full-resolution binary |
| `/api/images/{id}/thumb/` | GET | Thumbnail binary |

## Notes
- Images are stored directly in Postgres (`BinaryField`) per project decision — thumbnails are
  auto-generated on upload via Pillow to keep list/map views fast.
- Attribute submissions start as `pending` and require 2 confirmations (tunable via
  `RAMP_CONFIG["VERIFICATION_THRESHOLD"]` in `settings.py`) to flip to `verified`.
- Only users with `reputation_score >= 10` (or staff) can verify others' submissions —
  see `core/permissions.py::CanVerifySubmissions`.
- Run `python manage.py seed_ramp` after migrating to populate accessibility profiles,
  place categories, facility types, and attribute definitions — the app has no usable
  dropdowns until this is run.

## Seeding real places from OpenStreetMap

To avoid a cold-start empty map, you can bulk-import places that already have
`wheelchair=*` tags on OpenStreetMap (the same tags Wheelmap.org is built on):

```bash
# Preview what would be imported, without writing to the DB
docker compose exec backend python manage.py seed_from_osm --city "Kochi, India" --dry-run

# Actually import (default cap: 200 places)
docker compose exec backend python manage.py seed_from_osm --city "Kochi, India" --limit 200
```

Everything imported this way is clearly flagged as unverified in the UI
(`AccessPoint.notes` gets an "Imported from OpenStreetMap" disclaimer) and
still goes through RAMP's normal community-verification pipeline — OSM data
is a starting point, not a source of truth. Requires outbound network access
to `nominatim.openstreetmap.org` and `overpass-api.de`.
