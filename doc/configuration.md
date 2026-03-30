# Configuration Reference

This document lists configuration knobs that affect behavior in production and development.

## Next.js Config

File: `next.config.ts`

- `NEXT_ALLOWED_DEV_ORIGINS` (CSV)
  - Used only in development mode to set `allowedDevOrigins`.
  - Example: `NEXT_ALLOWED_DEV_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`

## Environment Variables

### Build-Time (baked into the client)

- `NEXT_PUBLIC_APP_VERSION`
  - Displayed in Settings.
  - CI sets this to the Git tag `vX.Y.Z` when building from a tag, otherwise to the short SHA.
  - Local builds can set it to `dev`.

### Runtime (set when starting the container)

These are read server-side and can be changed without rebuilding the Docker image.

- `NEXT_PUBLIC_ENABLE_DEBUG_MODE`
  - `1` enables debug UI controls even in production.
  - Implemented as runtime config via `GET /api/runtime-config` (reload the page after changing).
- `ENABLE_DEBUG_MODE`
  - `1` enables server-side debug-only API features.
  - Example: allowing `POST /api/logo?action=clear`.
- `LOGO_DEV_TOKEN`
  - Token for logo.dev used by `GET /api/logo` when fetching logos.
- `LOGO_MAX_BYTES`
  - Max bytes for downloaded logos (default 512 KiB; clamped to a sane max).

Note: despite the `NEXT_PUBLIC_` prefix, `NEXT_PUBLIC_ENABLE_DEBUG_MODE` is intentionally treated as runtime config in this project (it is not embedded into the client bundle).

## Station Fetch Behavior

`GET /api/stations` supports:

- `includeClosed=1` to include closed stations (defaults to false).
- `debug=1` to include raw upstream E-Control payloads in the response.
  - Only honored when debug is allowed (`NODE_ENV != production` or `ENABLE_DEBUG_MODE=1`).
