# BrewLite deployment on Render Free (Task 5.3)

This guide records the Render and GitHub Actions settings used by
`.github/workflows/cd.yml`. The workflow continues from the existing `CI`
workflow after a push to `main` and proceeds only when CI succeeds. Pull
requests never publish images or deploy. Do not add real credentials to this
file or to the repository.

## Docker validation before release

The `docker` job in `ci.yml` follows the API and web quality checks. It builds
both images for Linux AMD64 with `push: false`, loads them into the runner's
local Docker engine, and starts them against a temporary PostgreSQL 16 service.
It checks API `/health`, the web page, a nonempty seeded menu, and a second
database preparation against the existing catalog. The API uses the same
startup command and dynamic `PORT` setting as Render Free.

This job also runs on pull requests, using test credentials only. It does not
log in to GHCR, publish images, or contact Render. A successful `CI` run now
includes this Docker check, so CD cannot release when the container check fails.
Someone without Docker on their PC can use this check after the branch is
pushed for review. The actual container run remains unverified until Actions
or a compatible local Docker engine executes it.

## Render services

Create a managed PostgreSQL database and two image-backed Web Services for the
API and web app. Use the private **Internal Database URL** for the API's
`DATABASE_URL`; do not expose PostgreSQL to the public internet or place this
URL in GitHub Actions. The images are published to GHCR as
`ghcr.io/lmhau68/brewlite2-api` and `ghcr.io/lmhau68/brewlite2-web`. If the
packages are private, configure a GHCR read credential on both Render services.

Configure the API service:

| Setting | Value |
|---|---|
| Image | `ghcr.io/lmhau68/brewlite2-api:latest` for initial setup |
| Health Check Path | `/health` |
| Pre-Deploy Command | Leave empty (not available on Free) |
| Docker Command | `/bin/sh -c "node dist/database/prepare-production.js && exec node dist/main.js"` |
| `DATABASE_URL` | Render PostgreSQL **Internal Database URL** |
| `JWT_SECRET` | A unique random secret of at least 32 characters |
| `CORS_ORIGIN` | The public HTTPS URL of the web service |
| `DB_MIGRATIONS_RUN` | `false` (the preparation command runs migrations before API startup) |
| `SEED_STAFF_EMAIL`, `SEED_STAFF_PASSWORD` | Optional pair; set before the first launch if a demo staff account is needed |

The existing API image listens on Render's `PORT` and binds to `0.0.0.0`.
Override its Docker Command with the value above. The preparation process runs
transactional migrations before the API opens its HTTP port. An advisory lock
serializes overlapping starts. Preparation failure exits with a nonzero code,
so the `&&` prevents the API from starting; Render keeps routing to the previous
healthy deploy when available. Migrations must remain compatible with that
previous API while it serves traffic.

When both catalog tables (`products` and `toppings`) are empty, preparation runs
the existing seed in a transaction. Later deploys, restarts, and idle wake-ups
skip seeding, preserving inventory and product-size IDs. Set the optional staff
seed credentials before the first launch. Free services do not provide Shell
access, so there is no manual Shell step in this setup.

Configure the web service:

| Setting | Value |
|---|---|
| Image | `ghcr.io/lmhau68/brewlite2-web:latest` for initial setup |
| Health Check Path | `/` |

The web image is built with the public API URL. Set it as the GitHub Actions
repository variable `RENDER_API_URL` before the first release. Set
`RENDER_WEB_URL` to the web service's public HTTPS URL. Leave the web Docker
Command empty so the existing image's `npm run start` command is used.

## Initial setup before automatic releases

Render verifies that a GHCR image exists before creating an image-backed
service. The CD workflow also requires the Render settings before publishing,
so the initial images must be bootstrapped once by a team member with Docker:

1. Build and publish the first API image after this code is approved.
2. Create the Render database and API service from that image, using the
   settings above. The API initializes its empty catalog during startup.
3. Build and publish the first web image with `NEXT_PUBLIC_API_URL` set to the
   API's public HTTPS URL, then create the web service from that image.
4. Set the API's `CORS_ORIGIN` to the web URL and configure the GitHub variables
   and secrets below. Configure GHCR read credentials in Render for private
   packages. Disable any independent Git-based auto-deploys.

These are one-time setup steps. Afterward, every successful CI run for a push
to `main` publishes and deploys the checked commit automatically.

## GitHub Actions configuration

Add repository **Variables**:

| Name | Value |
|---|---|
| `RENDER_API_URL` | Public HTTPS URL of the API, without a trailing slash |
| `RENDER_WEB_URL` | Public HTTPS URL of the web service, without a trailing slash |
| `RENDER_API_SERVICE_ID` | Render API service ID (`srv-...`) |
| `RENDER_WEB_SERVICE_ID` | Render web service ID (`srv-...`) |

Add repository **Secrets**:

| Name | Value |
|---|---|
| `RENDER_API_DEPLOY_HOOK_URL` | API service's Render deploy hook URL |
| `RENDER_WEB_DEPLOY_HOOK_URL` | Web service's Render deploy hook URL |
| `RENDER_API_KEY` | Render API key, used to track deployments and trigger rollback |

`GITHUB_TOKEN` is provided by Actions and receives `packages: write` only in
the image publishing job. The workflow uses each service's deploy hook to
deploy the exact commit SHA image, then uses the Render API key to wait for
that deployment's state. Do not add production `DATABASE_URL` or `JWT_SECRET`
to GitHub Actions; they belong only in Render's API environment.

## Release and rollback behavior

The existing CI workflow runs lint, unit tests, API integration tests, and
application builds. Only after that workflow succeeds does this workflow build
both Docker images, tag them with the checked commit SHA (and `latest`), push
them to GHCR, trigger the two Render services, wait for the API migration and
deployment to finish, and smoke-test `/health` and `/`.

Smoke checks require HTTP 200. Failed migration/startup or post-deploy smoke
checks leave the workflow failed. Rollback restores application images, not
database contents; schema changes must support the previous application. A
destructive migration needs a separate data recovery plan before release.

If the new instance fails Render's health check, Render keeps the last healthy
deployment. If a post-deploy smoke test fails after promotion, the workflow
attempts to roll both services back to the deployments that were live before
the release. A failed first deployment has no previous version to restore; in
that case correct the Render configuration and redeploy. Keep previous GHCR
images available so Render can retrieve them during rollback.

Render Free instances can sleep and restart. Free PostgreSQL also expires, so
create it near the demo date and record its expiration in the handoff. See the
[Free service limits](https://render.com/docs/free) and
[Docker command documentation](https://render.com/docs/docker).
