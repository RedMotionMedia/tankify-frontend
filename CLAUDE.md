# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tankify: a Next.js (App Router) app that calculates whether it's worth driving to a cheaper gas station, given route distance, fuel prices, and vehicle consumption. Austrian-focused (E-Control pricing data, German default UI language) but supports EN and imperial units too.

## Commands

```bash
npm ci             # install (Node 22 required — see .nvmrc / engines in package.json)
npm run dev         # start dev server at http://localhost:3000
npm run build       # production build
npm run start       # run production build
npm run lint        # eslint (eslint-config-next core-web-vitals + typescript)
```

There is no test suite in this repo (no test runner configured). CI (`.github/workflows/build.yml`) only runs `npm run lint` and `npm run build` on every push/PR — treat both as required before considering a change done.

Docker: `Dockerfile` is a 3-stage build (deps/builder/runner) that bakes `NEXT_PUBLIC_APP_VERSION` in at build time and runs `next start` as the `node` user. Runtime env vars (`LOGO_DEV_TOKEN`, `ENABLE_DEBUG_MODE`, `NEXT_PUBLIC_ENABLE_DEBUG_MODE`, `NEXT_ALLOWED_DEV_ORIGINS`) are injected at container start, not baked in — see README "Quickstart (Docker)".

Release/deploy flow (informational, not something you'd normally trigger): `release.yml` builds+pushes a GHCR image on push to `main`/`v*` tags and auto-deploys to `dev`; `deploy.yml` is a manual/`workflow_call` job that patches a separate `tankify-gitops` repo to promote an image tag to `dev`/`prod`.

## Architecture

### Layout

- `src/app/` — Next.js App Router shell: root layout, the single page (`page.tsx`, forced dynamic — no HTML caching, to avoid stale UI behind proxies/CDNs after deploys), and all `/api/*` route handlers.
- `src/features/tankify/` — all actual feature code, split by where it runs/renders:
  - `shared/` — the bulk of the app: components, hooks, lib (pure calculation/formatting/unit-conversion helpers), types, i18n config. Used by both desktop and mobile.
  - `desktop/components/` and `mobile/components/` — layout-specific shells (e.g. `StationsSidebar` vs `MobileBottomSheet`/`MobileStationsSidebar`) that wrap shared pieces. `TankifyCalculator.tsx` picks between them at runtime based on viewport (`isDesktop` state, resolved client-side post-mount to avoid SSR hydration mismatches).
  - `server/` — server-only logic used by API routes (E-Control fetch/dedupe/merge logic in `server/econtrol/sprit.ts`, brand/logo resolution in `server/branding/stationLogo.ts`). Keep server-only code (secrets, Node APIs) here, not in `shared/`.
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`).

`TankifyCalculator.tsx` (~1300 lines) is the top-level client component and owns almost all app state (route points, prices, vehicle params, UI panel open/close state, settings). `MapPicker.tsx` (~1900 lines) is the other large component, owning the MapLibre map instance, markers, popups, and map-driven station search. Both are big and stateful — when editing, search within the file for the relevant state/handler rather than assuming a small, focused component.

### API routes are thin proxies, not a real backend

Every route under `src/app/api/*` proxies a public third-party API server-side (to hide tokens, add caching, and work around CORS), normalizes/trims the payload, and caches results **in an in-memory `Map`** (per server process — not shared across instances, resets on redeploy). There is no database. Pattern to follow for new endpoints: `runtime = "nodejs"`, validate query/body params defensively (these hit public/free APIs), cache with a TTL + `MAX_CACHE`-style eviction, set `Cache-Control` deliberately (`no-store` for anything containing raw upstream/debug data).

External services and where they're called from:
- **E-Control** (Austrian fuel price API) — `src/features/tankify/server/econtrol/sprit.ts`, exposed via `/api/stations`. Since E-Control has no bbox search, station coverage for a map viewport is approximated by sampling multiple lat/lon points across the bounds (`buildSamplePoints`) and merging/deduping results (`dedupeStations`/`mergeStations`) — this is the trickiest logic in the server layer.
- **OSRM** (public routing) — `/api/drive-distances` (distance/duration matrix) and `src/features/tankify/shared/lib/route.ts` (`fetchRoute`, called directly client-side, not proxied).
- **Nominatim** (OSM geocoding) — `src/features/tankify/shared/lib/geocode.ts`, called directly client-side (search box + reverse geocode), not proxied.
- **Frankfurter** (FX rates) — `/api/fx/rate`, `/api/fx/currencies`.
- **logo.dev** — `/api/logo`, resolves brand logos for stations (see `stationLogo.ts` for the name/website/email → domain → logo URL heuristics) and disk-caches images with size limits (`LOGO_MAX_BYTES`).
- IP-based geolocation (`ipwho.is` / `ipapi.co` fallback chain) — `/api/ip-location`.
- `/api/runtime-config` just exposes whether the debug UI is allowed, so the client can read env-derived flags without them being baked into the JS bundle at build time.

### Map: MapLibre via CDN script, not the npm package

The map is **MapLibre GL**, loaded at runtime via a `<script>`/`<link>` tag injected into `document.head` (`ensureMapLibreDeps()` in `shared/components/map/maplibre/ensureMapLibre.ts`, from `unpkg.com`), not via an npm dependency — there is no `maplibre-gl` entry in `package.json`. `leaflet`/`react-leaflet` *are* npm dependencies and `leaflet/dist/leaflet.css` is imported in the root layout, but they are not used for actual map rendering in the current codebase — don't assume `<MapContainer>`/react-leaflet components exist when working on map features; check `MapPicker.tsx` first.

### Units, currency, and i18n

- All state/calculation (`shared/lib/calc.ts`, `shared/lib/units.ts`) is kept in metric base units (km, liters, EUR) regardless of the user's selected `MeasurementSystem`/`CurrencySystem`; conversion happens only at the display layer. Follow this convention for any new numeric field to avoid unit-mixing bugs.
- FX conversion (`shared/lib/fx.ts`) converts EUR ⇄ selected currency using the rate from `/api/fx/rate`.
- i18n is a static dictionary (`shared/config/i18n.ts`, `de`/`en`), not a library — `TranslationSchema` is the single source of truth for every UI string; add new keys there in both languages.
