# Product Overview

Tankify helps users answer a practical question:

"Is it worth driving to a cheaper gas station?"

It is a Next.js web app that lets a user pick a start and a destination, then calculates the route distance/time and estimates whether the savings at the destination outweigh the cost of driving there.

## What The App Can Do

- Show an interactive map with gas stations within the current map view.
- Let the user choose start and destination:
  - Map click mode: pick points directly on the map.
  - Search: type an address or place name with autocomplete suggestions.
  - Use "Set as start"/"Set as destination" for a selected station.
- Calculate a road route (distance, duration) between start and destination (OSRM).
- Show calculated outcomes:
  - Trip cost estimate based on fuel consumption and destination fuel price.
  - Full-tank savings based on the local price vs destination price.
  - Net savings (savings minus trip cost).
  - A "worth it" indicator.
- Provide a mobile-friendly UI (bottom sheet) and a desktop sidebar layout.
- Provide settings:
  - Language (DE/EN)
  - Currency (via FX rates)
  - Measurement system (metric/imperial)
  - Fuel type
  - Optional debug tools (depending on environment flags)
  - Build version display (tag or SHA injected at build time)

## Gas Station Data

Gas stations are loaded for the currently visible map bounds via the internal endpoint:

- `GET /api/stations?south=...&west=...&north=...&east=...&centerLat=...&centerLon=...`

The backend fetches data from the Austrian E-Control fuel station API and returns a normalized list to the UI.

## Location Behavior (Startup)

On the first app load, the map will attempt, in order:

1. Browser geolocation (GPS on mobile where available).
2. IP-based location via `/api/ip-location` if geolocation is unavailable or denied.
3. Manual location entry: the user can type a place/address with suggestions and use it as the initial map center.

The initial location is not meant to jump between multiple fallback centers. The app waits for the first available coordinates and then uses that as the initial view.

## What You Can Change (And What Will Happen)

- Start/Destination points:
  - Changing either point affects routing and results.
  - "Calculate" commits the currently selected points as the basis for results.
- Fuel prices:
  - Local price is the reference for "savings".
  - Destination price is used to estimate trip cost.
  - Changing prices updates savings and profitability.
- Vehicle parameters:
  - Consumption changes trip cost and the break-even threshold.
  - Tank size changes the potential savings.
  - Average speed influences the time estimate.
- Map viewport:
  - The "Search here" control queries stations for the current visible map area.
  - Selecting a station in the list or on the map recenters/focuses the map on that station.

## External Services Used

- Map rendering: MapLibre (browser) with an OpenFreeMap style endpoint
- Routing (single route): `router.project-osrm.org`
- Routing distances (table): `router.project-osrm.org/table`
- Geocoding + autocomplete + reverse geocoding: Nominatim (`nominatim.openstreetmap.org`)
- IP-based location providers (via server route): `ipwho.is` and `ipapi.co`
- FX data: Frankfurter (`api.frankfurter.dev`)
- Brand logos: local assets and external logo fetching proxied through `/api/logo`

## Known Limitations

- Public third-party APIs can rate-limit or block requests.
- Routing is approximate (no live traffic).
- E-Control station coverage is best for Austria (because the source API is Austrian).
- Geolocation requires HTTPS (or localhost) in modern browsers.
