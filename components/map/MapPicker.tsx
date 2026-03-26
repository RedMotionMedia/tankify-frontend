"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TranslationSchema } from "@/config/i18n";
import {
    FuelType,
    MapPickMode,
    MeasurementSystem,
    Point,
    Station,
} from "@/types/tankify";
import { reverseGeocode } from "@/lib/geocode";
import { fetchStationsForVisibleMap } from "@/lib/route";
import { pricePerLiterToPerGallon } from "@/lib/units";
import {
    ensureMapLibreDeps,
    getMapLibre,
    type MapLibreMap,
    type MapLibreMarker,
} from "@/components/map/maplibre/ensureMapLibre";

type Props = {
    start: Point | null;
    end: Point | null;
    routeGeometry: [number, number][];
    pickMode: MapPickMode;
    fuelType: FuelType;
    measurementSystem: MeasurementSystem;
    debugMode: boolean;
    t: TranslationSchema;
    onMapPick: (type: "start" | "end", point: Point) => void;
    onStationsChange?: (stations: Station[]) => void;
    selectedStationId?: string | null;
    onStationSelect?: (station: Station) => void;
    defaultLocationEnabled?: boolean;
};

type UserLocation = { lat: number; lon: number };

const OPENFREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const HIDE_NON_ESSENTIAL_MARKERS_BELOW_ZOOM = 12;
// Default view when we don't yet have a user location or any route points.
// Keep this reasonably wide; when geolocation is enabled we pan to the user location,
// but we avoid starting overly zoomed-in.
const FALLBACK_VIEW = { center: [48.3069, 14.2858] as [number, number], zoom: 12 };

function isFiniteNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

function sanitizeLatLng(center: [number, number]): [number, number] {
    return isFiniteNumber(center[0]) && isFiniteNumber(center[1]) ? center : FALLBACK_VIEW.center;
}

function haversineKm(a: UserLocation, b: { lat: number; lon: number }): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h =
        sinDLat * sinDLat +
        Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function isNearKm(
    a: { lat: number; lon: number },
    b: { lat: number; lon: number },
    km: number
) {
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) return false;
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lon)) return false;
    return haversineKm({ lat: a.lat, lon: a.lon }, b) <= km;
}

function isPointAtAnyStation(
    point: { lat: number; lon: number },
    stations: Station[],
    km = 0.03
): boolean {
    return stations.some((s) => isNearKm(point, s, km));
}

function withCacheBuster(url: string, cacheBust: number): string {
    if (!url) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${cacheBust}`;
}

function getStationInitials(name: string | undefined): string {
    const value = (name ?? "").trim();
    if (!value) return "?";
    const parts = value.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "?";
    const second = parts[1]?.[0] ?? "";
    return (first + second).toUpperCase();
}

function formatBadgePrice(
    value: number | null | undefined,
    measurementSystem: MeasurementSystem
) {
    if (value === null || value === undefined) return null;
    const converted =
        measurementSystem === "metric" ? value : pricePerLiterToPerGallon(value);
    return converted.toFixed(3);
}

const stationMarkerTemplateCache = new Map<string, HTMLElement>();

function createStationMarkerElement({
    station,
    hasPrice,
    badgeText,
    logoCacheBust,
}: {
    station: Station;
    hasPrice: boolean;
    badgeText: string | null;
    logoCacheBust: number;
}): HTMLElement {
    const initials = getStationInitials(station.brandName ?? station.name);
    const logoUrl = station.logoUrl
        ? withCacheBuster(station.logoUrl, logoCacheBust)
        : "";
    const key = `${hasPrice ? "p1" : "p0"}|${badgeText ?? ""}|${logoUrl || initials}`;

    const cached = stationMarkerTemplateCache.get(key);
    if (cached) return cached.cloneNode(true) as HTMLElement;

    const wrapper = document.createElement("div");
    wrapper.className = "station-marker";

    const ringClass = hasPrice ? "station-logo--ok" : "station-logo--missing";
    const logo = document.createElement("div");
    logo.className = `station-logo ${ringClass}`;

    const fallback = document.createElement("div");
    fallback.className = "station-logo__fallback";
    fallback.textContent = initials;
    logo.appendChild(fallback);

    if (logoUrl) {
        const img = document.createElement("img");
        img.className = "station-logo__img";
        img.alt = "";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.src = logoUrl;
        img.addEventListener("error", () => {
            img.style.display = "none";
        });
        logo.appendChild(img);
    }

    wrapper.appendChild(logo);

    if (badgeText) {
        const badge = document.createElement("div");
        badge.className = "price-badge-inner station-marker__badge";
        badge.textContent = badgeText;
        wrapper.appendChild(badge);
    }

    stationMarkerTemplateCache.set(key, wrapper);
    return wrapper.cloneNode(true) as HTMLElement;
}

function createRoutePointElement(type: "start" | "end"): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className =
        "route-point-marker " +
        (type === "start" ? "route-point-marker--start" : "route-point-marker--end");
    wrapper.innerHTML = `<div class="route-point"><span class="route-point__label">${
        type === "start" ? "S" : "Z"
    }</span></div>`;
    return wrapper;
}

function createUserLocationElement(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "user-location-marker";
    wrapper.innerHTML = `
<div class="user-location" aria-hidden="true">
  <div class="user-location__pulse"></div>
  <div class="user-location__dot"></div>
</div>
`.trim();
    return wrapper;
}

function boundsLikeFromLatLon(points: Array<[number, number]>): [[number, number], [number, number]] | null {
    let minLat = Infinity;
    let minLon = Infinity;
    let maxLat = -Infinity;
    let maxLon = -Infinity;

    for (const [lat, lon] of points) {
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        minLat = Math.min(minLat, lat);
        minLon = Math.min(minLon, lon);
        maxLat = Math.max(maxLat, lat);
        maxLon = Math.max(maxLon, lon);
    }

    if (!Number.isFinite(minLat) || !Number.isFinite(minLon) || !Number.isFinite(maxLat) || !Number.isFinite(maxLon)) {
        return null;
    }

    return [[minLon, minLat], [maxLon, maxLat]];
}

function recenterToPoints(
    map: MapLibreMap,
    points: Array<[number, number]>,
    duration: number
) {
    if (points.length === 0) return;

    // With only one point (start OR end), fitBounds zooms in aggressively.
    // Keep the current zoom and just pan to the point.
    if (points.length === 1) {
        const [lat, lon] = points[0];
        map.easeTo({ center: [lon, lat], zoom: map.getZoom(), duration });
        return;
    }

    const boundsLike = boundsLikeFromLatLon(points);
    if (!boundsLike) return;
    map.fitBounds(boundsLike, { padding: 30, duration });
}

export default function MapPicker({
    start,
    end,
    routeGeometry,
    pickMode,
    fuelType,
    measurementSystem,
    debugMode,
    t,
    onMapPick,
    onStationsChange,
    selectedStationId,
    onStationSelect,
    defaultLocationEnabled,
}: Props) {
    const [stations, setStations] = useState<Station[]>([]);
    const [logoCacheBust, setLogoCacheBust] = useState(0);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const userLocationRef = useRef<UserLocation | null>(null);

    const [searchLoading, setSearchLoading] = useState(false);
    const [searchHint, setSearchHint] = useState<string>(t.route.tapSearchHere);

    const [locationEnabled, setLocationEnabled] = useState(
        Boolean(defaultLocationEnabled)
    );
    const locationEnabledRef = useRef(Boolean(defaultLocationEnabled));
    const [locationError, setLocationError] = useState<string | null>(null);
    const [locationAttempt, setLocationAttempt] = useState(0);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const mapLoadedRef = useRef(false);
    const mapCleanupRef = useRef<(() => void) | null>(null);
    const lastAutoFitSignatureRef = useRef<string>("");
    const pendingRecenterPointsRef = useRef<Array<[number, number]> | null>(null);
    const pendingRecenterIdRef = useRef(0);
    const pendingRecenterClearTimerRef = useRef<number | null>(null);
    const resizeDebounceTimerRef = useRef<number | null>(null);

    useEffect(() => {
        userLocationRef.current = userLocation;
    }, [userLocation]);

    useEffect(() => {
        locationEnabledRef.current = locationEnabled;
    }, [locationEnabled]);

    function setPendingRecenter(points: Array<[number, number]>) {
        pendingRecenterIdRef.current += 1;
        const id = pendingRecenterIdRef.current;
        pendingRecenterPointsRef.current = points;

        if (pendingRecenterClearTimerRef.current != null) {
            window.clearTimeout(pendingRecenterClearTimerRef.current);
            pendingRecenterClearTimerRef.current = null;
        }

        // If no resize happens (or the map doesn't change size), don't keep a pending recenter forever.
        pendingRecenterClearTimerRef.current = window.setTimeout(() => {
            pendingRecenterClearTimerRef.current = null;
            if (pendingRecenterIdRef.current !== id) return;
            pendingRecenterPointsRef.current = null;
        }, 1200);
    }

    const pickModeRef = useRef<MapPickMode>(pickMode);
    useEffect(() => {
        pickModeRef.current = pickMode;
    }, [pickMode]);

    const didCenterOnEnableRef = useRef(false);
    const watchIdRef = useRef<number | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const markerBucketRef = useRef<{
        start: MapLibreMarker | null;
        end: MapLibreMarker | null;
        user: MapLibreMarker | null;
        stations: MapLibreMarker[];
    }>({ start: null, end: null, user: null, stations: [] });

    // If start/end are represented by a station marker (route point markers hidden),
    // keep those station markers visible even when we hide non-essential markers at low zoom.
    const protectedStationIdsRef = useRef<Set<string>>(new Set());

    const hiddenStationsRef = useRef<boolean | null>(null);
    const applyStationMarkerVisibility = useCallback((hideStations: boolean, force = false) => {
        if (!force && hiddenStationsRef.current === hideStations) return;
        hiddenStationsRef.current = hideStations;

        const keepIds = protectedStationIdsRef.current;
        const bucket = markerBucketRef.current;
        for (const m of bucket.stations) {
            try {
                const el = typeof m.getElement === "function" ? m.getElement() : null;
                if (!el) continue;
                const id = el.dataset.stationId;
                const keep = id ? keepIds.has(id) : false;
                el.style.display = hideStations && !keep ? "none" : "";
            } catch {
                // ignore
            }
        }
    }, []);

    useEffect(() => {
        const ids = new Set<string>();
        const km = 0.03;
        if (start) {
            for (const s of stations) {
                if (isNearKm(start, s, km)) ids.add(s.id);
            }
        }
        if (end) {
            for (const s of stations) {
                if (isNearKm(end, s, km)) ids.add(s.id);
            }
        }
        if (selectedStationId) ids.add(selectedStationId);
        protectedStationIdsRef.current = ids;

        // If we're currently zoomed out (stations hidden), re-apply visibility so
        // start/end station markers become visible immediately.
        const map = mapRef.current;
        if (map) {
            applyStationMarkerVisibility(
                map.getZoom() < HIDE_NON_ESSENTIAL_MARKERS_BELOW_ZOOM,
                true
            );
        }
    }, [start, end, stations, selectedStationId, applyStationMarkerVisibility]);

    const safeCenter = useMemo<[number, number]>(() => {
        if (start && end) {
            return sanitizeLatLng([(start.lat + end.lat) / 2, (start.lon + end.lon) / 2]);
        }
        if (start) return sanitizeLatLng([start.lat, start.lon]);
        if (end) return sanitizeLatLng([end.lat, end.lon]);
        return FALLBACK_VIEW.center;
    }, [start, end]);

    const hideStartMarker =
        !start ||
        (userLocation != null && isNearKm(userLocation, start, 0.03)) ||
        isPointAtAnyStation(start, stations, 0.03);

    const hideEndMarker =
        !end ||
        (userLocation != null && isNearKm(userLocation, end, 0.03)) ||
        isPointAtAnyStation(end, stations, 0.03);

    // Logo cache clear event from SettingsModal.
    useEffect(() => {
        function handleLogoCacheCleared() {
            stationMarkerTemplateCache.clear();
            setLogoCacheBust((v) => v + 1);
        }

        window.addEventListener("tankify:logo-cache-cleared", handleLogoCacheCleared);
        return () =>
            window.removeEventListener("tankify:logo-cache-cleared", handleLogoCacheCleared);
    }, []);

    // Create/destroy map.
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                await ensureMapLibreDeps();
                if (cancelled) return;

                const maplibre = getMapLibre();
                const container = containerRef.current;
                if (!container) return;
                if (mapRef.current) return;

                const map = new maplibre.Map({
                    container,
                    style: OPENFREE_MAP_STYLE_URL,
                    center: [safeCenter[1], safeCenter[0]],
                    zoom: FALLBACK_VIEW.zoom,
                    attributionControl: false,
                    dragRotate: false,
                    pitchWithRotate: false,
                    touchPitch: false,
                });
                mapRef.current = map;

                // Show attribution text without the compact "i" button.
                try {
                    if (maplibre.AttributionControl && typeof map.addControl === "function") {
                        map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-left");
                    }
                } catch {}

                const onMoveStart = () => setSearchHint(t.route.areaChanged);
                map.on("movestart", onMoveStart);
                map.on("zoomstart", onMoveStart);

                const onZoomVisibility = () => {
                    applyStationMarkerVisibility(
                        map.getZoom() < HIDE_NON_ESSENTIAL_MARKERS_BELOW_ZOOM
                    );
                };
                map.on("zoom", onZoomVisibility);

                map.on("click", async (e: unknown) => {
                    const mode = pickModeRef.current;
                    if (!mode) return;
                    const lngLat = (e as { lngLat?: { lat?: unknown; lng?: unknown } }).lngLat;
                    const lat = typeof lngLat?.lat === "number" ? lngLat.lat : undefined;
                    const lon = typeof lngLat?.lng === "number" ? lngLat.lng : undefined;
                    if (typeof lat !== "number" || typeof lon !== "number") return;
                    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
                    const label = await reverseGeocode(lat, lon);
                    onMapPick(mode, { lat, lon, label });
                });

                map.on("load", () => {
                    mapLoadedRef.current = true;
                    try {
                        map.addSource("route", {
                            type: "geojson",
                            data: { type: "FeatureCollection", features: [] },
                        });
                        map.addLayer({
                            id: "route-line",
                            type: "line",
                            source: "route",
                            layout: { "line-join": "round", "line-cap": "round" },
                            paint: { "line-color": "#2563eb", "line-width": 5 },
                        });
                    } catch {
                        // ignore
                    }
                });

                const ro = new ResizeObserver(() => {
                    // Debounce: while panels animate, the map container height changes a few times.
                    // We want to re-apply a pending recenter once the size has stabilized.
                    if (resizeDebounceTimerRef.current != null) {
                        window.clearTimeout(resizeDebounceTimerRef.current);
                        resizeDebounceTimerRef.current = null;
                    }

                    resizeDebounceTimerRef.current = window.setTimeout(() => {
                        resizeDebounceTimerRef.current = null;

                        // If the container is currently collapsed (0x0) during a layout transition,
                        // calling resize/fitBounds can put MapLibre into a bad internal state.
                        const rect = container.getBoundingClientRect();
                        if (rect.width < 10 || rect.height < 10) return;

                        try {
                            map.resize();
                        } catch {}

                        // DevTools open causes frequent resizes; MapLibre can occasionally "lose" marker positioning.
                        // Fully recreate the user-location marker (equivalent to toggling location off/on).
                        try {
                            const bucket = markerBucketRef.current;
                            const loc = userLocationRef.current;
                            if (locationEnabledRef.current && loc) {
                                try {
                                    bucket.user?.remove?.();
                                } catch {}
                                bucket.user = null;

                                const maplibre = getMapLibre();
                                const el = createUserLocationElement();
                                bucket.user = new maplibre.Marker({ element: el, anchor: "center" })
                                    .setLngLat([loc.lon, loc.lat])
                                    .addTo(map);
                            }
                        } catch {}

                        const pending = pendingRecenterPointsRef.current;
                        if (!pending) return;
                        pendingRecenterPointsRef.current = null;
                        if (pendingRecenterClearTimerRef.current != null) {
                            window.clearTimeout(pendingRecenterClearTimerRef.current);
                            pendingRecenterClearTimerRef.current = null;
                        }
                        try {
                            recenterToPoints(map, pending, 350);
                        } catch {}
                    }, 140);
                });
                ro.observe(container);

                mapCleanupRef.current = () => {
                    ro.disconnect();
                    if (resizeDebounceTimerRef.current != null) {
                        window.clearTimeout(resizeDebounceTimerRef.current);
                        resizeDebounceTimerRef.current = null;
                    }
                    if (pendingRecenterClearTimerRef.current != null) {
                        window.clearTimeout(pendingRecenterClearTimerRef.current);
                        pendingRecenterClearTimerRef.current = null;
                    }
                    map.off("movestart", onMoveStart);
                    map.off("zoomstart", onMoveStart);
                    map.off("zoom", onZoomVisibility);
                };
            } catch (e) {
                console.warn("MapLibre failed to load", e);
            }
        })();

        const bucketAtMount = markerBucketRef.current;
        return () => {
            cancelled = true;

            const bucket = bucketAtMount;
            for (const m of bucket.stations) {
                try {
                    m.remove();
                } catch {}
            }
            bucket.stations = [];
            try {
                bucket.start?.remove?.();
            } catch {}
            try {
                bucket.end?.remove?.();
            } catch {}
            try {
                bucket.user?.remove?.();
            } catch {}
            bucket.start = null;
            bucket.end = null;
            bucket.user = null;

            const map = mapRef.current;
            if (map) {
                try {
                    mapCleanupRef.current?.();
                } catch {}
                try {
                    map.remove();
                } catch {}
            }
            mapCleanupRef.current = null;
            mapLoadedRef.current = false;
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update route source.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoadedRef.current) return;

        const valid = routeGeometry.filter((p) => isFiniteNumber(p[0]) && isFiniteNumber(p[1]));
        const coords = valid.map(([lat, lon]) => [lon, lat]);
        const data =
            coords.length > 0
                ? {
                      type: "FeatureCollection",
                      features: [
                          {
                              type: "Feature",
                              geometry: { type: "LineString", coordinates: coords },
                              properties: {},
                          },
                      ],
                  }
                : { type: "FeatureCollection", features: [] };

        try {
            const src = map.getSource("route");
            if (src?.setData) src.setData(data);
        } catch {}
    }, [routeGeometry]);

    // Fit bounds when inputs change.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const validRoute = routeGeometry.filter(
            (p) => isFiniteNumber(p[0]) && isFiniteNumber(p[1])
        );
        const points =
            validRoute.length > 0
                ? validRoute
                : [
                    ...(start ? [sanitizeLatLng([start.lat, start.lon])] : []),
                    ...(end ? [sanitizeLatLng([end.lat, end.lon])] : []),
                ];
        const signature = (() => {
            if (validRoute.length > 0) {
                const first = validRoute[0];
                const last = validRoute[validRoute.length - 1];
                return `r:${validRoute.length}:${first[0]},${first[1]}:${last[0]},${last[1]}`;
            }
            const s = start ? `${start.lat},${start.lon}` : "-";
            const e = end ? `${end.lat},${end.lon}` : "-";
            return `p:${s}:${e}`;
        })();

        // Prevent auto-recentering on unrelated re-renders (e.g. "Hier suchen" updates stations state).
        if (lastAutoFitSignatureRef.current === signature) return;
        lastAutoFitSignatureRef.current = signature;

        if (points.length === 0) return;

        try {
            // Apply immediately, but also re-apply once after any layout-driven resize settles.
            setPendingRecenter(points);
            window.requestAnimationFrame(() => {
                try {
                    map.resize();
                } catch {}
                try {
                    recenterToPoints(map, points, 650);
                } catch {}
            });
        } catch {}
    }, [start, end, routeGeometry]);

    // Rebuild markers when stations or marker-visual inputs change.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const maplibre = getMapLibre();

        const bucket = markerBucketRef.current;
        for (const m of bucket.stations) {
            try {
                m.remove();
            } catch {}
        }
        bucket.stations = [];

        for (const station of stations) {
            const selectedPrice = fuelType === "diesel" ? station.diesel : station.super95;
            const hasPrice = selectedPrice !== null && selectedPrice !== undefined;
            const badgeText = hasPrice ? formatBadgePrice(selectedPrice, measurementSystem) : null;

            const el = createStationMarkerElement({ station, hasPrice, badgeText, logoCacheBust });
            el.dataset.stationId = station.id;
            el.addEventListener("click", (ev) => {
                ev.stopPropagation();
                onStationSelect?.(station);
            });

            const m = new maplibre.Marker({ element: el, anchor: "center" })
                .setLngLat([station.lon, station.lat])
                .addTo(map);
            bucket.stations.push(m);
        }

        // Ensure current zoom-based visibility is applied to newly created markers.
        applyStationMarkerVisibility(
            map.getZoom() < HIDE_NON_ESSENTIAL_MARKERS_BELOW_ZOOM,
            true
        );
    }, [
        stations,
        fuelType,
        measurementSystem,
        logoCacheBust,
        onStationSelect,
        applyStationMarkerVisibility,
    ]);

    // Highlight and center the selected station (no popups; selection is shown in the UI list).
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const bucket = markerBucketRef.current;
        for (const m of bucket.stations) {
            try {
                const el = typeof m.getElement === "function" ? m.getElement() : null;
                if (!el) continue;
                const id = el.dataset.stationId;
                const isSelected = !!selectedStationId && id === selectedStationId;
                el.classList.toggle("station-marker--selected", isSelected);
                el.style.zIndex = isSelected ? "10" : "";
            } catch {
                // ignore
            }
        }

        if (!selectedStationId) return;
        const station = stations.find((s) => s.id === selectedStationId);
        if (!station) return;
        try {
            map.easeTo({
                center: [station.lon, station.lat],
                zoom: map.getZoom(),
                duration: 650,
            });
        } catch {}
    }, [selectedStationId, stations]);

    // Start/end markers.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const maplibre = getMapLibre();

        const bucket = markerBucketRef.current;

        try {
            bucket.start?.remove?.();
        } catch {}
        try {
            bucket.end?.remove?.();
        } catch {}
        bucket.start = null;
        bucket.end = null;

        if (!hideStartMarker && start) {
            const el = createRoutePointElement("start");
            el.addEventListener("click", (ev) => ev.stopPropagation());
            bucket.start = new maplibre.Marker({ element: el, anchor: "bottom" })
                .setLngLat([start.lon, start.lat])
                .addTo(map);
        }

        if (!hideEndMarker && end) {
            const el = createRoutePointElement("end");
            el.addEventListener("click", (ev) => ev.stopPropagation());
            bucket.end = new maplibre.Marker({ element: el, anchor: "bottom" })
                .setLngLat([end.lon, end.lat])
                .addTo(map);
        }
    }, [start, end, hideStartMarker, hideEndMarker]);

    // User location marker.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const maplibre = getMapLibre();

        const bucket = markerBucketRef.current;
        try {
            bucket.user?.remove?.();
        } catch {}
        bucket.user = null;

        if (locationEnabled && userLocation) {
            const el = createUserLocationElement();
            bucket.user = new maplibre.Marker({ element: el, anchor: "center" })
                .setLngLat([userLocation.lon, userLocation.lat])
                .addTo(map);
        }
    }, [locationEnabled, userLocation]);

    // Geolocation watch.
    useEffect(() => {
        const map = mapRef.current;

        if (!locationEnabled) {
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
            if (watchIdRef.current != null) {
                try {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                } catch {}
            }
            watchIdRef.current = null;
            return;
        }

        if (typeof window === "undefined") return;
        if (!window.isSecureContext) {
            setLocationError("Geolocation requires HTTPS (or localhost).");
            return;
        }
        if (!navigator.geolocation) {
            setLocationError("Geolocation not available.");
            return;
        }

        const commonOptions: PositionOptions = {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 9000,
        };

        // Fast initial fix.
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

                setUserLocation({ lat, lon });
                setLocationError(null);
                try {
                    window.dispatchEvent(
                        new CustomEvent("tankify:user-location", { detail: { lat, lon } })
                    );
                } catch {}
                try {
                    window.localStorage.setItem(
                        "tankify-last-location",
                        JSON.stringify({ lat, lon, ts: Date.now() })
                    );
                } catch {}

                if (!didCenterOnEnableRef.current && map) {
                    didCenterOnEnableRef.current = true;
                    try {
                        map.easeTo({
                            center: [lon, lat],
                            // Don't zoom in on enable; keep whatever zoom the map currently has.
                            zoom: map.getZoom(),
                            duration: 750,
                        });
                    } catch {}
                }
            },
            (err) => setLocationError(err.message || "Location error"),
            commonOptions
        );

        if (watchIdRef.current != null) {
            try {
                navigator.geolocation.clearWatch(watchIdRef.current);
            } catch {}
            watchIdRef.current = null;
        }

        const id = navigator.geolocation.watchPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

                setUserLocation({ lat, lon });
                setLocationError(null);
                try {
                    window.dispatchEvent(
                        new CustomEvent("tankify:user-location", { detail: { lat, lon } })
                    );
                } catch {}
                try {
                    window.localStorage.setItem(
                        "tankify-last-location",
                        JSON.stringify({ lat, lon, ts: Date.now() })
                    );
                } catch {}

                if (!didCenterOnEnableRef.current && map) {
                    didCenterOnEnableRef.current = true;
                    try {
                        map.easeTo({
                            center: [lon, lat],
                            // Don't zoom in on enable; keep whatever zoom the map currently has.
                            zoom: map.getZoom(),
                            duration: 750,
                        });
                    } catch {}
                }
            },
            (err) => {
                setLocationError(err.message || "Location error");
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                if ((err as GeolocationPositionError).code !== 1) {
                    retryTimerRef.current = setTimeout(() => {
                        setLocationAttempt((v) => v + 1);
                    }, 3000);
                }
            },
            commonOptions
        );

        watchIdRef.current = id;

        return () => {
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
            if (watchIdRef.current != null) {
                try {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                } catch {}
            }
            watchIdRef.current = null;
        };
    }, [locationEnabled, locationAttempt]);

    async function handleSearchHere() {
        const map = mapRef.current;
        if (!map) return;

        const currentZoom = Number(map.getZoom?.() ?? 0);
        if (currentZoom < 12) {
            setSearchHint(t.route.zoomInMore);
            setStations([]);
            onStationsChange?.([]);
            return;
        }

        setSearchLoading(true);
        setSearchHint(t.route.stationsLoading);

        try {
            const b = map.getBounds();
            const sw = b.getSouthWest();
            const ne = b.getNorthEast();
            const c = map.getCenter();

            const result = await fetchStationsForVisibleMap(
                {
                    south: sw.lat,
                    west: sw.lng,
                    north: ne.lat,
                    east: ne.lng,
                    centerLat: c.lat,
                    centerLon: c.lng,
                },
                { debug: debugMode }
            );

            setStations(result.stations as Station[]);
            onStationsChange?.(result.stations as Station[]);

            if (result.error) {
                setSearchHint(result.error);
            } else {
                setSearchHint(
                    result.stations.length > 0
                        ? `${result.stations.length} ${t.route.stationsLoaded}`
                        : t.route.noStationsFound
                );
            }
        } catch {
            setStations([]);
            onStationsChange?.([]);
            setSearchHint(t.route.stationsLoadFailed);
        } finally {
            setSearchLoading(false);
        }
    }

    function handleRecenter() {
        const map = mapRef.current;
        if (!map) return;

        const validRoute = routeGeometry.filter(
            (p) => isFiniteNumber(p[0]) && isFiniteNumber(p[1])
        );
        const points =
            validRoute.length > 0
                ? validRoute
                : [
                    ...(start ? [sanitizeLatLng([start.lat, start.lon])] : []),
                    ...(end ? [sanitizeLatLng([end.lat, end.lon])] : []),
                ];
        if (points.length === 0) return;
        try {
            // If a layout transition resizes the map right after recentering,
            // the resulting view can look "off". Keep one pending recenter to re-apply after resize.
            setPendingRecenter(points);

            // Apply immediately too, but after a resize tick.
            window.requestAnimationFrame(() => {
                try {
                    map.resize();
                } catch {}
                try {
                    recenterToPoints(map, points, 650);
                } catch {}
            });
        } catch {}
    }

    function canUseGeolocation(): boolean {
        if (typeof window === "undefined") return false;
        if (!window.isSecureContext) return false;
        return typeof navigator !== "undefined" && !!navigator.geolocation;
    }

    useEffect(() => {
        setSearchHint(t.route.tapSearchHere);
    }, [t]);

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="h-full w-full" />

            <div className="pointer-events-none absolute left-3 top-3 z-1000 flex flex-col gap-2">
                <button
                    type="button"
                    onClick={handleRecenter}
                    className="pointer-events-auto rounded-full bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-lg transition active:scale-95"
                >
                    {t.route.center}
                </button>

                <button
                    type="button"
                    onClick={() => {
                        if (!canUseGeolocation()) return;
                        setLocationEnabled((v) => !v);
                    }}
                    disabled={!canUseGeolocation()}
                    title={
                        !canUseGeolocation()
                            ? "Geolocation not available"
                            : locationError
                                ? locationError
                                : locationEnabled
                                    ? "Standort ausschalten"
                                    : "Standort einschalten"
                    }
                    aria-pressed={locationEnabled}
                    className={
                        "pointer-events-auto rounded-full px-3 py-2 text-sm font-medium shadow-lg transition active:scale-95 " +
                        (locationEnabled
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-white text-gray-900 hover:bg-gray-50") +
                        (!canUseGeolocation() ? " opacity-60" : "")
                    }
                >
                    {t.route.myLocation}
                </button>
            </div>

            <div className="pointer-events-none absolute bottom-1/12 left-1/2 z-1000 -translate-x-1/2 md:bottom-1">
                <div className="flex flex-col items-center gap-1">
                    <button
                        type="button"
                        onClick={handleSearchHere}
                        className="pointer-events-auto rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 active:scale-95"
                    >
                        {searchLoading ? t.route.loading : t.route.searchHere}
                    </button>

                    <div className="w-65 rounded-full bg-white/50 px-3 py-1 text-center text-[10px] text-gray-700 shadow md:w-auto md:text-xs">
                        {searchHint}
                    </div>
                </div>
            </div>
        </div>
    );
}
