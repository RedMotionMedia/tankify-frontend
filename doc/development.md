# Development Guide

## Requirements

- Node.js 22 (recommended, matches the Docker image and CI)
- npm (package-lock is committed)

This repo includes `.nvmrc` and sets `engines.node` in `package.json` to keep versions consistent.

If you are on Windows PowerShell and `npm` scripts are blocked due to ExecutionPolicy, run npm via a different shell (cmd.exe / Git Bash) or adjust your policy for your environment.

## Install

```bash
npm ci
```

## Run Locally

```bash
npm run dev
```

Open:

`http://localhost:3000`

## Lint And Typecheck

```bash
npm run lint
npm run build
```

If `npm run lint` is blocked (PowerShell), you can run ESLint via Node:

```bash
node node_modules/eslint/bin/eslint.js .
```

Typecheck only:

```bash
node node_modules/typescript/bin/tsc --noEmit
```

## Project Structure (High Level)

- `src/app`
  - Next.js App Router entrypoint, including server routes under `src/app/api/*`.
- `src/features/tankify/shared`
  - Shared UI, hooks, config, and domain logic used across desktop and mobile layouts.
- `src/features/tankify/mobile` and `src/features/tankify/desktop`
  - Platform-specific UI components.
- `src/features/tankify/server`
  - Server-only code, for example E-Control fetching and brand/logo resolution.

## Core User Flow (Code Pointers)

- Main page: `src/app/page.tsx` renders `TankifyCalculator`.
- Main state machine and UI: `src/features/tankify/shared/components/calculator/TankifyCalculator.tsx`
  - Holds the "draft" vs "committed" start/destination points.
  - "Calculate" commits draft points and triggers routing.
  - Maintains settings (language, units, currency, fuel type) and passes translations down.
- Map and stations: `src/features/tankify/shared/components/map/MapPicker.tsx`
  - Manages map rendering, station markers, and "search here" behavior.
  - Handles startup location resolution (geo, IP, manual).
- Autocomplete field (start/destination/manual location): `src/features/tankify/shared/components/ui/LocationField.tsx`
  - Uses Nominatim suggestions via `geocodeSuggestions`.
  - Displays a dropdown overlay list and supports clearing via an "x" button.
- Numeric sliders with manual input: `src/features/tankify/shared/components/ui/SliderNumberField.tsx`
  - Supports clearing the number input and re-entering values.

## i18n

All user-visible strings should live in:

- `src/features/tankify/shared/config/i18n.ts`

Components receive the translation object `t` and should not hardcode UI strings.

## Internal API Routes

- `GET /api/stations`
  - Fetch stations for visible bounds (E-Control upstream) and return normalized station DTOs.
- `POST /api/drive-distances`
  - Uses OSRM table API to get driving distances/durations from one origin to multiple stations.
- `GET /api/ip-location`
  - Server-side IP geolocation, tries multiple providers and returns structured errors.
- `GET /api/fx/currencies` and `GET /api/fx/rate`
  - Currency list and FX conversion rates (Frankfurter).
- `GET /api/runtime-config`
  - Exposes runtime config for the client (for example whether debug UI controls are allowed in production).
- `GET /api/logo`
  - Proxies and caches brand logo requests, supports a local asset fallback.
  - `POST /api/logo?action=clear` clears cache when debug is enabled.

## Adding A Feature

Typical workflow:

1. Implement UI behavior in `TankifyCalculator` (state, events) and/or `MapPicker` (map/stations).
2. Put new UI copy into `i18n.ts` and pass `t` into affected components.
3. If you need server data, add a new App Router route under `src/app/api/...`.
4. Run `tsc --noEmit` and ESLint before opening a PR.

