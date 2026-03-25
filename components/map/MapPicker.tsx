"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TranslationSchema } from "@/config/i18n";
import {
    CurrencySystem,
    FuelType,
    Language,
    MapPickMode,
    MeasurementSystem,
    Point,
    Station,
} from "@/types/tankify";
import { reverseGeocode } from "@/lib/geocode";
import { fetchStationsForVisibleMap } from "@/lib/route";
import { pricePerLiterToPerGallon } from "@/lib/units";
import StationPopupContent from "@/components/map/StationPopupContent";
import {
    ensureMapLibreDeps,
    getMapLibre,
    type MapLibreGlobal,
    type MapLibreMap,
    type MapLibreMarker,
    type MapLibrePopup,
} from "@/components/map/maplibre/ensureMapLibre";

type Props = {
    start: Point;
    end: Point;
    routeGeometry: [number, number][];
    pickMode: MapPickMode;
    fuelType: FuelType;
    measurementSystem: MeasurementSystem;
    currencySystem: CurrencySystem;
    language: Language;
    debugMode: boolean;
    t: TranslationSchema;
    onMapPick: (type: "start" | "end", point: Point) => void;
    onSelectStationAsDestination: (payload: {
        point: Point;
        price?: number | null;
        station: Station;
    }) => void;
    onSelectStationAsStart: (payload: {
        point: Point;
        price?: number | null;
        station: Station;
    }) => void;
};

type UserLocation = { lat: number; lon: number };

const OPENFREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const FALLBACK_VIEW = { center: [48.3069, 14.2858] as [number, number], zoom: 9 };

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

function buildBoundsFromPoints(maplibre: MapLibreGlobal, points: Array<[number, number]>) {
    const b = new maplibre.LngLatBounds();
    for (const [lat, lon] of points) {
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        b.extend([lon, lat]);
    }
    return b;
}

export default function MapPicker({
    start,
    end,
    routeGeometry,
    pickMode,
    fuelType,
    measurementSystem,
    currencySystem,
    language,
    debugMode,
    t,
    onMapPick,
    onSelectStationAsDestination,
    onSelectStationAsStart,
}: Props) {
    const [stations, setStations] = useState<Station[]>([]);
    const [logoCacheBust, setLogoCacheBust] = useState(0);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

    const [searchLoading, setSearchLoading] = useState(false);
    const [searchHint, setSearchHint] = useState<string>(t.route.tapSearchHere);

    const [locationEnabled, setLocationEnabled] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [locationAttempt, setLocationAttempt] = useState(0);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const mapLoadedRef = useRef(false);
    const mapCleanupRef = useRef<(() => void) | null>(null);

    const pickModeRef = useRef<MapPickMode>(pickMode);
    useEffect(() => {
        pickModeRef.current = pickMode;
    }, [pickMode]);

    const userLocationRef = useRef<UserLocation | null>(userLocation);
    useEffect(() => {
        userLocationRef.current = userLocation;
    }, [userLocation]);

    const didCenterOnEnableRef = useRef(false);
    const watchIdRef = useRef<number | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const activePopupRef = useRef<{
        popup: MapLibrePopup;
        root: Root;
        node: HTMLElement;
    } | null>(null);

    const markerBucketRef = useRef<{
        start: MapLibreMarker | null;
        end: MapLibreMarker | null;
        user: MapLibreMarker | null;
        stations: MapLibreMarker[];
    }>({ start: null, end: null, user: null, stations: [] });

    const safeCenter = useMemo<[number, number]>(() => {
        const lat = (start.lat + end.lat) / 2;
        const lon = (start.lon + end.lon) / 2;
        return sanitizeLatLng([lat, lon]);
    }, [start, end]);

    const hideStartMarker =
        (userLocation != null && isNearKm(userLocation, start, 0.03)) ||
        isPointAtAnyStation(start, stations, 0.03);

    const hideEndMarker =
        (userLocation != null && isNearKm(userLocation, end, 0.03)) ||
        isPointAtAnyStation(end, stations, 0.03);

    function closeActivePopup() {
        const active = activePopupRef.current;
        if (!active) return;
        activePopupRef.current = null;
        try {
            active.root.unmount();
        } catch {}
        try {
            active.popup.remove();
        } catch {}
    }

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
                    attributionControl: true,
                    dragRotate: false,
                    pitchWithRotate: false,
                    touchPitch: false,
                });
                mapRef.current = map;

                const onMoveStart = () => setSearchHint(t.route.areaChanged);
                map.on("movestart", onMoveStart);
                map.on("zoomstart", onMoveStart);

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
                    try {
                        map.resize();
                    } catch {}
                });
                ro.observe(container);

                mapCleanupRef.current = () => {
                    ro.disconnect();
                    map.off("movestart", onMoveStart);
                    map.off("zoomstart", onMoveStart);
                };
            } catch (e) {
                console.warn("MapLibre failed to load", e);
            }
        })();

        const bucketAtMount = markerBucketRef.current;
        return () => {
            cancelled = true;
            closeActivePopup();

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
        const maplibre = getMapLibre();

        const validRoute = routeGeometry.filter((p) => isFiniteNumber(p[0]) && isFiniteNumber(p[1]));
        const points =
            validRoute.length > 0
                ? validRoute
                : [sanitizeLatLng([start.lat, start.lon]), sanitizeLatLng([end.lat, end.lon])];

        try {
            const bounds = buildBoundsFromPoints(maplibre, points);
            if (typeof bounds?.isEmpty === "function" && bounds.isEmpty()) return;
            map.fitBounds(bounds, { padding: 30, duration: 650 });
        } catch {}
    }, [start, end, routeGeometry]);

    // Rebuild markers when stations or marker-visual inputs change.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const maplibre = getMapLibre();

        closeActivePopup();

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
            el.addEventListener("click", (ev) => {
                ev.stopPropagation();
                closeActivePopup();

                const node = document.createElement("div");
                const root = createRoot(node);
                root.render(
                    <StationPopupContent
                        station={station}
                        selectedPrice={selectedPrice}
                        measurementSystem={measurementSystem}
                        currencySystem={currencySystem}
                        language={language}
                        debugMode={debugMode}
                        logoCacheBust={logoCacheBust}
                        userLocation={userLocationRef.current}
                        t={t}
                        onSelectStationAsStart={(payload) => {
                            onSelectStationAsStart(payload);
                            closeActivePopup();
                        }}
                        onSelectStationAsDestination={(payload) => {
                            onSelectStationAsDestination(payload);
                            closeActivePopup();
                        }}
                    />
                );

                const popup = new maplibre.Popup({
                    closeButton: true,
                    closeOnClick: true,
                    maxWidth: "420px",
                    className: "station-popup",
                })
                    .setLngLat([station.lon, station.lat])
                    .setDOMContent(node)
                    .addTo(map);

                popup.on("close", () => {
                    try {
                        root.unmount();
                    } catch {}
                });

                activePopupRef.current = { popup, root, node };
            });

            const m = new maplibre.Marker({ element: el, anchor: "center" })
                .setLngLat([station.lon, station.lat])
                .addTo(map);
            bucket.stations.push(m);
        }

        return () => {
            closeActivePopup();
        };
    }, [
        stations,
        fuelType,
        measurementSystem,
        currencySystem,
        language,
        debugMode,
        logoCacheBust,
        t,
        onSelectStationAsDestination,
        onSelectStationAsStart,
    ]);

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

        if (!hideStartMarker) {
            const el = createRoutePointElement("start");
            el.addEventListener("click", (ev) => ev.stopPropagation());
            bucket.start = new maplibre.Marker({ element: el, anchor: "bottom" })
                .setLngLat([start.lon, start.lat])
                .addTo(map);
        }

        if (!hideEndMarker) {
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
                            zoom: Math.max(map.getZoom(), 14),
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
                            zoom: Math.max(map.getZoom(), 14),
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
        if (currentZoom < 13) {
            setSearchHint(t.route.zoomInMore);
            setStations([]);
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
            setSearchHint(t.route.stationsLoadFailed);
        } finally {
            setSearchLoading(false);
        }
    }

    function handleRecenter() {
        const map = mapRef.current;
        if (!map) return;
        const maplibre = getMapLibre();

        const validRoute = routeGeometry.filter((p) => isFiniteNumber(p[0]) && isFiniteNumber(p[1]));
        const points =
            validRoute.length > 0
                ? validRoute
                : [sanitizeLatLng([start.lat, start.lon]), sanitizeLatLng([end.lat, end.lon])];
        try {
            const bounds = buildBoundsFromPoints(maplibre, points);
            map.fitBounds(bounds, { padding: 30, duration: 650 });
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

    // When UI-meaningful options change, close popups (avoids stale text/units in already-open popups).
    useEffect(() => {
        closeActivePopup();
    }, [fuelType, measurementSystem, currencySystem, language, t, logoCacheBust]);

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="h-full w-full" />

            <div className="pointer-events-none absolute right-3 top-3 z-1000 flex flex-col gap-2">
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
