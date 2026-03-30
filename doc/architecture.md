# Architecture Notes

This is a Next.js App Router application. Most logic lives in client components, with a small set of server routes acting as a backend-for-frontend.

## Frontend Layers

- UI/state orchestration:
  - `TankifyCalculator` is the main container component and owns most state.
  - It separates "draft" inputs (what the user is editing) from "committed" inputs (what results are based on).
- Map/station presentation:
  - `MapPicker` renders the map, markers, and overlays.
  - Map rendering is done with MapLibre in the browser and an OpenFreeMap style.
  - Stations are fetched by bounds ("search here") and displayed on the map and in a list.
- Reusable UI:
  - `LocationField` provides address autocomplete with an overlay dropdown and a clear button.
  - `SliderNumberField` combines a slider with a numeric input.
- i18n:
  - Components are driven by a translation schema (`t`) instead of hardcoded strings.

## Backend-For-Frontend

The app uses internal API routes for:

- Gas station lookup (E-Control) with caching and optional debug payloads.
- OSRM table distances for station sorting/labels.
- IP-based location resolution with provider fallback.
- FX rate and currency name fetching with caching.
- Brand logo proxying/caching and local fallback.
- Runtime configuration used by the client (for example debug UI enablement in production).

## External Dependencies (Network)

- E-Control fuel stations API (Austria)
- OSRM public routing endpoints
- Nominatim for geocoding and suggestions
- IP location providers
- OpenFreeMap style/tiles endpoints
- Frankfurter FX API
- Logo sources (logo.dev / favicon service) via `/api/logo`

## Caching Strategy

- `/api/stations`: in-memory cache keyed by rounded bounds for 15 minutes (lean payload only).
- `/api/drive-distances`: short in-memory cache (20 seconds).
- `/api/fx/*`: in-memory cache (currencies 24h, rates 1h; serves stale briefly on failure).
- `/api/logo`: in-memory cache with ETag support and long TTL.

All caches are process-local (per container instance) and reset on restart.
