# Run Your Own Image (Docker)

This project ships as a standard Next.js production server inside a Docker image.

## Requirements

- Docker (or compatible container runtime)

Note: the Docker image uses Node.js 22 (Alpine) as its base.

## Run A Prebuilt Image

If you have an image reference (for example from GHCR), run it like this:

```bash
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  ghcr.io/redmotionmedia/tankify-frontend:<tag>
```

Then open:

`http://localhost:3000`

## Build Your Own Image Locally

From the repository root:

```bash
docker build -t tankify-frontend:local \
  --build-arg NEXT_PUBLIC_ENABLE_DEBUG_MODE=0 \
  --build-arg NEXT_PUBLIC_APP_VERSION=dev \
  .
```

Run it:

```bash
docker run --rm -p 3000:3000 tankify-frontend:local
```

## Environment Variables

This app uses a mix of server-side env vars and `NEXT_PUBLIC_*` build-time vars.

Common variables:

- `NEXT_PUBLIC_APP_VERSION`
  - Build-time value shown in Settings.
  - GitHub Actions sets this to the Git tag (e.g. `v1.2.3`) when building from a tag, otherwise to the short SHA.
  - Local builds can set it to `dev`.
- `NEXT_PUBLIC_ENABLE_DEBUG_MODE`
  - If set to `1`, allows the UI to show debug controls even in production builds.
- `ENABLE_DEBUG_MODE`
  - Server-side flag. When set to `1`, enables debug-only API features (for example clearing the logo cache).
- `LOGO_DEV_TOKEN`
  - Token used by the `/api/logo` proxy to fetch high quality brand logos from logo.dev.
  - If not provided, the logo endpoint falls back to a favicon service.
- `LOGO_MAX_BYTES`
  - Upper bound for downloaded logos (defaults to 512 KiB, clamped to a sane max).

In Docker builds, values are passed as build arguments and then baked into the image as env vars.

## Health And Ports

- The container listens on port `3000`.
- Start command: `next start` (Node) in production mode.

