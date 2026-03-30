# Run With Docker

This project ships as a standard Next.js production server inside a Docker image.

## Requirements

- Docker (or compatible container runtime)

The image uses Node.js 22 (Alpine).

## Option 1: Run The Prebuilt Image (GHCR)

Use `latest` for quick testing. For production deployments, prefer a pinned version tag (for example `vX.Y.Z` or `sha-abcdef0`).

```bash
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_ENABLE_DEBUG_MODE=1 \
  -e ENABLE_DEBUG_MODE=1 \
  -e LOGO_DEV_TOKEN=... \
  ghcr.io/redmotionmedia/tankify-frontend:latest
```

Open `http://localhost:3000`.

## Option 2: Build The Image Yourself

```bash
docker build -t tankify-frontend:local \
  --build-arg NEXT_PUBLIC_APP_VERSION=dev \
  .
```

## Runtime Environment Variables

Set these when starting the container. They are not baked into the image.

- `NEXT_PUBLIC_ENABLE_DEBUG_MODE`
  - `1` shows debug UI controls even in production.
  - Evaluated at runtime via `GET /api/runtime-config` (reload the page after changing).
- `ENABLE_DEBUG_MODE`
  - `1` enables server-side debug-only API features (for example `POST /api/logo?action=clear`).
- `LOGO_DEV_TOKEN`
  - Token for logo.dev used by `GET /api/logo` for higher-quality brand logos.
  - If not set, `/api/logo` falls back to a favicon service.
- `LOGO_MAX_BYTES`
  - Upper bound for downloaded logos (default 512 KiB; clamped to a sane max).

Example:

```bash
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_ENABLE_DEBUG_MODE=1 \
  -e ENABLE_DEBUG_MODE=1 \
  -e LOGO_DEV_TOKEN=... \
  tankify-frontend:local
```

## Docker Compose Example

```yaml
services:
  tankify:
    image: ghcr.io/redmotionmedia/tankify-frontend:latest
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_ENABLE_DEBUG_MODE: "1"
      ENABLE_DEBUG_MODE: "1"
      LOGO_DEV_TOKEN: ${LOGO_DEV_TOKEN}
```

## Ports

- Listens on port `3000`
- Entrypoint: `next start`
