# RAMP Frontend (React + Leaflet)

Scaffolded pages: Home (map), Places list, Place detail (access points,
facilities, structured attributes, confirm/dispute), Login, Register
(with multi-select accessibility profile), Add Place (guided multi-step
submission flow: place → main entrance + attributes → facility → photo).

## Setup

```bash
cd ramp_frontend
npm install
npm run dev
```

Runs on `http://localhost:3000` and proxies `/api` requests to the Django
backend at `http://localhost:8000` (see `vite.config.js`). Start the backend
first (see `ramp_backend/README.md`).

## Notes / known gaps to close next
- `AddPlace.jsx` hardcodes facility-type IDs (1–6) matching the `seed_ramp`
  order — replace with a live `GET /api/facility-types/` fetch once that
  endpoint is added (not yet in the locked core API set).
- No route-planning UI yet (Module 6 backend tables exist, no frontend page).
- No reviews/ratings UI yet (Module 5).
- No gamification/notifications UI yet (Modules 7-8).
- No venue self-reporting portal UI yet (Module 9).
- Verified with `npm run build` — 139 modules compile with zero errors.

## Design notes
Palette and type choices are deliberately restrained: high-contrast text,
visible focus rings everywhere, and a recurring "confidence badge" pattern
that always pairs color with text/icon (never color alone), since this is
an accessibility product first.
