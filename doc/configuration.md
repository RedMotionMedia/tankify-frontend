# Configuration Reference

This document lists configuration knobs that affect behavior in production and development.

## Next.js Config

File: `next.config.ts`

- `NEXT_ALLOWED_DEV_ORIGINS` (CSV)
  - Used only in development mode to set `allowedDevOrigins`.
  - Example:
    - `NEXT_ALLOWED_DEV_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`

## Build/Runtime Environment Variables

### Public (baked into the client)

These are read as `process.env.NEXT_PUBLIC_*` in client code. In Next.js, they are embedded at build time.

- `NEXT_PUBLIC_APP_VERSION`
  - Displayed in Settings.
  - Intended value: Git tag `vX.Y.Z` when available, otherwise short SHA.
- `NEXT_PUBLIC_ENABLE_DEBUG_MODE`
  - `1` enables debug UI features in production builds.

### Server-side (not exposed to client)

- `ENABLE_DEBUG_MODE`
  - Enables server-side debug features when set to `1`.
  - Example: allowing `POST /api/logo?action=clear`.
- `LOGO_DEV_TOKEN`
  - Token for logo.dev used by `/api/logo` when fetching logos.
- `LOGO_MAX_BYTES`
  - Max bytes for downloaded logos.

## Station Fetch Behavior

`/api/stations` supports:

- `includeClosed=1` to include closed stations (defaults to false)
- `debug=1` to include raw upstream E-Control station payloads in the response.
  - Only honored when debug is allowed (`NODE_ENV != production` or `ENABLE_DEBUG_MODE=1`).

## IP Location Behavior

`/api/ip-location`:

- Detects client IP primarily via forwarded headers (`x-forwarded-for`, `x-real-ip`, etc.).
- Falls back to provider-side auto-detection when running locally (no public IP available).
- Tries multiple providers (`ipwho.is`, then `ipapi.co`) and returns structured error JSON if both fail.

