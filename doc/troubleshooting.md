# Troubleshooting

## Geolocation Does Not Work (Safari / iOS)

Symptoms:

- Safari asks for location permission but the app still shows "location disabled" or "could not determine location".

Things to check:

- The site must be served over HTTPS (or `localhost`) for geolocation to work reliably.
- iOS Safari private browsing can behave differently for permissions and storage.
- If geolocation works in a normal tab but not in private browsing, try a normal tab, disable content blockers, and verify the permission is set to Allow for the site in Safari settings.

App behavior:

- On startup the app tries geolocation first, then IP-based location, then manual input.
- If geolocation is denied or unavailable, use manual location entry to continue.

## IP Location Fails

Symptoms:

- The startup panel cannot determine location and falls back to manual entry.

Why this can happen:

- IP providers may rate-limit (HTTP 429) or block (HTTP 403) the server IP.
- In local development, there is no public client IP. The app calls the provider without an explicit IP.
- Requests can fail due to network/DNS restrictions.

How to debug:

- Inspect the `/api/ip-location` response in the browser network tab. It returns structured JSON including which provider(s) were tried.

## No Stations / Stations Load Failed

Things to check:

- Zoom in more (large bounds can yield fewer or no results depending on upstream behavior).
- The E-Control API may be temporarily unavailable or rate-limited.
- Verify `GET /api/stations` returns JSON and not an error status.

## Autocomplete Suggestions Do Not Appear

Suggestions use Nominatim. If suggestions never show:

- Check if requests to `https://nominatim.openstreetmap.org/search` are blocked (CORS/adblock/network).
- Verify you are typing at least a few characters; very short queries return no suggestions.

## Logos Missing Or Wrong

- Logos are resolved by station name/website/email and fetched through `GET /api/logo`.
- If `LOGO_DEV_TOKEN` is not set, the app falls back to a favicon service and quality may be lower.
- The Settings panel can clear the logo cache when debug is enabled. In production, debug UI controls require `NEXT_PUBLIC_ENABLE_DEBUG_MODE=1` at runtime, and the cache clear endpoint requires `ENABLE_DEBUG_MODE=1` at runtime.
