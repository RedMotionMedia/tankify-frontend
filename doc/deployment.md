# Deployment And CI/CD (GitHub Actions)

This repository uses GitHub Actions to build and publish Docker images and to deploy them via a separate GitOps repo.

## Workflows

### Build

File: `.github/workflows/build.yml`

- Runs on every push (all branches) and pull requests.
- Installs dependencies, lints, and runs a production build.
- Uses Node.js 22 for the workflow runtime (to match local development and Docker).

### Release (Build And Push Image)

File: `.github/workflows/release.yml`

Triggers:

- Push to `main`
- Push tag matching `v*` (for example `v1.2.3`)

Behavior:

- Builds and pushes an immutable image tag based on the short SHA:
  - `sha-<7chars>`
- If the trigger is a tag push (`refs/tags/v*`), it additionally retags that image as:
  - `<tag>` (for example `v1.2.3`)
  - `latest`

Version injection:

- The workflow sets `NEXT_PUBLIC_APP_VERSION` during the Docker build:
  - Tag build: `NEXT_PUBLIC_APP_VERSION=vX.Y.Z`
  - Non-tag build: `NEXT_PUBLIC_APP_VERSION=<shortSHA>`
- The app shows this value inside the Settings panel.

### Deploy

File: `.github/workflows/deploy.yml`

- Deploys a specific image tag (`version` input) to a stage (`dev` or `prod`).
- Validates that the image tag exists in GHCR.
- Checks out a separate GitOps repository and updates the deployment overlay to the new image tag.

## Environments And Secrets

The workflow uses:

- `LOGO_DEV_TOKEN` (secret)
- `ENABLE_DEBUG_MODE` (environment variable)
- `GITOPS_REPO_TOKEN` (secret, for pushing to the GitOps repo)

## Tagging Recommendations

- Use a Git tag `vX.Y.Z` when you want a stable, human-readable release version in the UI.
- Use `main` for continuous dev deployments (it will deploy the SHA-tag by default).

