# Tankify Frontend

A Next.js app that helps you decide whether it is worth driving to a cheaper gas station.

<img alt="Tankify screenshot" src="doc/img.png" />

## Documentation

The full documentation lives under [`doc/`](./doc/README.md):

- Product overview, user flows, and what you can change
- Running your own Docker image
- Development guide (local setup, code pointers, internal APIs)
- Configuration, deployment, and troubleshooting

## Quickstart (Development)

Requirements: Node.js 22+ and npm.

Tip: this repo includes `.nvmrc` and sets `engines.node` in `package.json`.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Quickstart (Docker)

```bash
docker build -t tankify-frontend:local \
  --build-arg NEXT_PUBLIC_APP_VERSION=dev \
  .

docker run --rm -p 3000:3000 \
  -e NEXT_PUBLIC_ENABLE_DEBUG_MODE=1 \
  -e ENABLE_DEBUG_MODE=1 \
  -e LOGO_DEV_TOKEN=... \
  tankify-frontend:local
```

## Notes

- Map: MapLibre with an OpenFreeMap style.
- Routing: OSRM public endpoints.
- Search and suggestions: Nominatim.
- Gas station data: Austrian E-Control API via `/api/stations`.
- The Settings panel shows the build version (`NEXT_PUBLIC_APP_VERSION`), injected at build time by the CI pipeline (Git tag `v*` or short SHA).

