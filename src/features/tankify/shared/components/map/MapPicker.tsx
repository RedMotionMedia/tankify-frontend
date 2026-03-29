"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { TranslationSchema } from "@/features/tankify/shared/config/i18n";
import {
    CurrencySystem,
    FuelType,
    MapPickMode,
    MeasurementSystem,
    Point,
    Station,
} from "@/features/tankify/shared/types/tankify";
import { geocode, reverseGeocode } from "@/features/tankify/shared/lib/geocode";
import { fetchStationsForVisibleMap } from "@/features/tankify/shared/lib/route";
import { pricePerLiterToPerGallon } from "@/features/tankify/shared/lib/units";
import { eurToQuote } from "@/features/tankify/shared/lib/fx";
import {
    ensureMapLibreDeps,
    getMapLibre,
    type MapLibreMap,
    type MapLibreMarker,
} from "./maplibre/ensureMapLibre";

type Props = {
    start: Point | null;
    end: Point | null;
    routeGeometry: [number, number][];
    // Height in pixels that is visually covered at the bottom (e.g. mobile BottomSheet).
    // Used to keep recenter/fitBounds results within the visible viewport.
    viewportBottomInsetPx?: number;
    pickMode: MapPickMode;
    fuelType: FuelType;
    measurementSystem: MeasurementSystem;
    currencySystem: CurrencySystem;
    eurToCurrencyRate: number;
    debugMode: boolean;
    t: TranslationSchema;
    onMapPick: (type: "start" | "end", point: Point) => void;
    onStationsChange?: (stations: Station[]) => void;
    selectedStationId?: string | null;
    stationFocusRequestId?: number;
    onStationSelect?: (station: Station) => void;
    defaultLocationEnabled?: boolean;
    hideSearchOverlayRequestId?: number;
    onSearchHereStart?: () => void;
    recenterRequestId?: number;
    suspendStartup?: boolean;
};

type UserLocation = { lat: number; lon: number };
type GeoPermissionState = PermissionState | "unsupported" | "unavailable";

const OPENFREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const HIDE_NON_ESSENTIAL_MARKERS_BELOW_ZOOM = 12;
const DEFAULT_ZOOM = 12;

function isFiniteNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

function sanitizeLatLng(center: [number, number]): [number, number] | null {
    return isFiniteNumber(center[0]) && isFiniteNumber(center[1]) ? center : null;
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
    measurementSystem: MeasurementSystem,
    currencySystem: CurrencySystem,
    eurToCurrencyRate: number
) {
    if (value === null || value === undefined) return null;
    const converted =
        measurementSystem === "metric" ? value : pricePerLiterToPerGallon(value);
    const inCurrency = eurToQuote(converted, eurToCurrencyRate);
    void currencySystem; // keep badge text compact (number only) for now
    return inCurrency.toFixed(3);
}

const stationMarkerTemplateCache = new Map<string, HTMLElement>();

function getTapSearchHereHint(t: TranslationSchema, label: string): string {
    if (label.includes("Tankstellen")) {
        return `Tippe auf "${label}", um Tankstellen im Kartenausschnitt zu laden.`;
    }
    if (label.toLowerCase().includes("gas station")) {
        return `Tap "${label}" to load stations in this area.`;
    }
    return t.route.tapSearchHere;
}

function getAreaChangedHint(t: TranslationSchema, label: string): string {
    if (label.includes("Tankstellen")) {
        return `Kartenausschnitt geaendert. Tippe auf "${label}".`;
    }
    if (label.toLowerCase().includes("gas station")) {
        return `Map area changed. Tap "${label}".`;
    }
    return t.route.areaChanged;
}

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
    duration: number,
    viewportBottomInsetPx: number
) {
    if (points.length === 0) return;
    const bottomInset = Math.max(0, viewportBottomInsetPx || 0);

    // With only one point (start OR end), fitBounds zooms in aggressively.
    // Keep the current zoom and just pan to the point.
    if (points.length === 1) {
        const [lat, lon] = points[0];
        const canProject = typeof map.project === "function" && typeof map.unproject === "function";
        if (canProject && bottomInset > 0) {
            try {
                const p = map.project!([lon, lat]);
                const shifted = map.unproject!({ x: p.x, y: p.y + bottomInset / 3 });
                map.easeTo({ center: [shifted.lng, shifted.lat], zoom: map.getZoom(), duration });
                return;
            } catch {}
        }

        map.easeTo({ center: [lon, lat], zoom: map.getZoom(), duration });
        return;
    }

    const boundsLike = boundsLikeFromLatLon(points);
    if (!boundsLike) return;
    if (bottomInset <= 0) {
        map.fitBounds(boundsLike, { padding: 30, duration });
        return;
    }

    map.fitBounds(boundsLike, { padding: { top: 90, right: 30, bottom: bottomInset -60, left: 30 }, duration });
}

export default function MapPicker({
    start,
    end,
    routeGeometry,
    viewportBottomInsetPx,
    pickMode,
    fuelType,
    measurementSystem,
    currencySystem,
    eurToCurrencyRate,
    debugMode,
    t,
    onMapPick,
    onStationsChange,
    selectedStationId,
    stationFocusRequestId,
    onStationSelect,
    defaultLocationEnabled,
    hideSearchOverlayRequestId,
    onSearchHereStart,
    recenterRequestId,
    suspendStartup = false,
}: Props) {
    const [stations, setStations] = useState<Station[]>([]);
    const [logoCacheBust, setLogoCacheBust] = useState(0);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const userLocationRef = useRef<UserLocation | null>(null);
    const onStationSelectRef = useRef<Props["onStationSelect"]>(onStationSelect);

    const SEARCH_HERE_SEEN_KEY = "tankify-search-here-seen-v1";
    const [searchHereSeen, setSearchHereSeen] = useState(false);
    const searchHereSeenRef = useRef(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchHint, setSearchHint] = useState<string>(() =>
        getTapSearchHereHint(t, t.route.searchHereLong ?? t.route.searchHere)
    );
    const [needsSearchHere, setNeedsSearchHere] = useState(true);
    const [hideSearchOverlay, setHideSearchOverlay] = useState(false);
    const lastHideReqIdRef = useRef<number | null>(null);

    const [locationEnabled, setLocationEnabled] = useState(
        Boolean(defaultLocationEnabled)
    );
    const locationEnabledRef = useRef(Boolean(defaultLocationEnabled));
    const prevLocationEnabledRef = useRef(Boolean(defaultLocationEnabled));
    const didAutoEnableLocationRef = useRef(Boolean(defaultLocationEnabled));
    const [locationError, setLocationError] = useState<string | null>(null);
    const [locationAttempt, setLocationAttempt] = useState(0);
    const [geoPermission, setGeoPermission] = useState<GeoPermissionState>("unsupported");
    // Safari (especially iOS) can report incorrect geolocation permission state via the Permissions API.
    // We only "trust" denied once we observed a real GeolocationPositionError(code=1) at runtime.
    const geoDeniedConfirmedRef = useRef(false);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const mapLoadedRef = useRef(false);
    const mapCleanupRef = useRef<(() => void) | null>(null);
    const lastAutoFitSignatureRef = useRef<string>("");
    // Once the user pans/zooms manually, stop auto-fitting until an explicit recenter action happens.
    const suppressAutoFitRef = useRef(false);
    const pendingRecenterPointsRef = useRef<Array<[number, number]> | null>(null);
    const pendingRecenterIdRef = useRef(0);
    const pendingRecenterClearTimerRef = useRef<number | null>(null);
    const resizeDebounceTimerRef = useRef<number | null>(null);
    const resizeRafRef = useRef<number | null>(null);
    const lastResizeSizeRef = useRef<{ w: number; h: number } | null>(null);
    const viewportBottomInsetRef = useRef(0);

    useEffect(() => {
        viewportBottomInsetRef.current =
            typeof viewportBottomInsetPx === "number" && Number.isFinite(viewportBottomInsetPx)
                ? Math.max(0, viewportBottomInsetPx)
                : 0;
    }, [viewportBottomInsetPx]);

    useEffect(() => {
        userLocationRef.current = userLocation;
    }, [userLocation]);

    // Avoid hydration mismatches: server render cannot know whether geolocation is available.
    // Keep initial render stable and only compute capabilities after mount.
    const [geoAvailable, setGeoAvailable] = useState(false);
    useEffect(() => {
        try {
            setGeoAvailable(Boolean(window.isSecureContext && navigator.geolocation));
        } catch {
            setGeoAvailable(false);
        }
    }, []);

    const startRef = useRef<Point | null>(start);
    const endRef = useRef<Point | null>(end);
    const routeGeometryRef = useRef<[number, number][]>(routeGeometry);
    useEffect(() => {
        startRef.current = start;
        endRef.current = end;
        routeGeometryRef.current = routeGeometry;
    }, [start, end, routeGeometry]);

    useEffect(() => {
        onStationSelectRef.current = onStationSelect;
    }, [onStationSelect]);

    useEffect(() => {
        searchHereSeenRef.current = searchHereSeen;
    }, [searchHereSeen]);

    useEffect(() => {
        locationEnabledRef.current = locationEnabled;
    }, [locationEnabled]);

    // Detect existing permission state without triggering a browser prompt.
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!window.isSecureContext || !navigator.geolocation) {
            setGeoPermission("unavailable");
            setLocationEnabled(false);
            return;
        }

        const permissions = navigator.permissions;
        if (!permissions?.query) {
            setGeoPermission("unsupported");
            return;
        }

        let cancelled = false;
        let status: PermissionStatus | null = null;

        permissions
            .query({ name: "geolocation" as PermissionName })
            .then((s) => {
                status = s;
                if (cancelled) return;

                const apply = () => {
                    const state = status?.state ?? "prompt";
                    setGeoPermission(state);

                    // Auto-enable only once, and only if permission is already granted.
                    if (!didAutoEnableLocationRef.current && state === "granted") {
                        didAutoEnableLocationRef.current = true;
                        setLocationEnabled(true);
                    }

                    // If permission becomes denied, force off only if this "denied" was confirmed via
                    // the geolocation API itself. (Avoid false negatives on Safari iOS.)
                    if (state === "denied" && geoDeniedConfirmedRef.current) {
                        setLocationEnabled(false);
                        setLocationError("Standort ist deaktiviert. Bitte in den Browser-Einstellungen aktivieren.");
                    }
                };

                apply();
                status.onchange = apply;
            })
            .catch(() => {
                if (cancelled) return;
                setGeoPermission("unsupported");
            });

        return () => {
            cancelled = true;
            if (status) status.onchange = null;
        };
    }, []);

    useEffect(() => {
        const prev = prevLocationEnabledRef.current;
        prevLocationEnabledRef.current = locationEnabled;

        // When turning off, behave like "no location available":
        // stop showing distance UI in the app by clearing the live location signal.
        if (prev && !locationEnabled) {
            setUserLocation(null);
            setLocationError(null);
            didCenterOnEnableRef.current = false;

            const dispatch = () => {
                try {
                    window.dispatchEvent(new CustomEvent("tankify:user-location-disabled"));
                } catch {}
            };

            if (typeof queueMicrotask === "function") queueMicrotask(dispatch);
            else Promise.resolve().then(dispatch);
        }
    }, [locationEnabled]);

    useEffect(() => {
        if (hideSearchOverlayRequestId == null) return;
        if (lastHideReqIdRef.current === hideSearchOverlayRequestId) return;
        lastHideReqIdRef.current = hideSearchOverlayRequestId;
        setHideSearchOverlay(true);
    }, [hideSearchOverlayRequestId]);

    useEffect(() => {
        try {
            setSearchHereSeen(window.localStorage.getItem(SEARCH_HERE_SEEN_KEY) === "1");
        } catch {
            setSearchHereSeen(false);
        }
    }, []);

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

    function safeResizePreserveView(map: MapLibreMap, container: HTMLElement) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w < 10 || h < 10) return;

        const last = lastResizeSizeRef.current;
        if (last && last.w === w && last.h === h) return;
        lastResizeSizeRef.current = { w, h };

        // If the map size changes (e.g. due to panel transitions), allow the overlay to appear again.
        setHideSearchOverlay(false);

        // During layout transitions (panels sliding/collapsing) frequent resizes can cause visible "shaking"
        // due to ongoing camera animations + rounding. Freeze the current camera around the resize.
        const center = map.getCenter();
        const zoom = map.getZoom();
        const bearing = typeof map.getBearing === "function" ? map.getBearing() : 0;
        const pitch = typeof map.getPitch === "function" ? map.getPitch() : 0;

        try {
            map.stop?.();
        } catch {}

        try {
            map.resize();
        } catch {}

        try {
            map.jumpTo?.({
                center: [center.lng, center.lat],
                zoom,
                bearing,
                pitch,
            });
        } catch {}
    }

    const pickModeRef = useRef<MapPickMode>(pickMode);
    useEffect(() => {
        pickModeRef.current = pickMode;
    }, [pickMode]);

    const didCenterOnEnableRef = useRef(false);
    const watchIdRef = useRef<number | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track whether the current geolocation enable attempt was initiated by an explicit user gesture
    // (clicking our UI button). Safari can behave differently for "auto" requests on page load.
    const geoEnableUserGestureRef = useRef(false);
    // True once we have successfully received at least one position fix in this session.
    const geoEverGrantedRef = useRef(false);

    const markerBucketRef = useRef<{
        start: MapLibreMarker | null;
        end: MapLibreMarker | null;
        user: MapLibreMarker | null;
        stations: MapLibreMarker[];
    }>({ start: null, end: null, user: null, stations: [] });

    const [startupCenter, setStartupCenter] = useState<{
        lat: number;
        lon: number;
        source: "gps" | "ip" | "manual";
    } | null>(null);
    const [startupCenterError, setStartupCenterError] = useState<string | null>(null);
    const [startupManualQuery, setStartupManualQuery] = useState("");
    const [startupManualLoading, setStartupManualLoading] = useState(false);
    const [startupManualError, setStartupManualError] = useState<string | null>(null);
    const [startupAttempt, setStartupAttempt] = useState(0);
    const startupReqIdRef = useRef(0);
    const ipAbortRef = useRef<AbortController | null>(null);
    const startupLastStartedAttemptRef = useRef<number | null>(null);

    const fetchIpLocation = useCallback(async (): Promise<{ lat: number; lon: number } | null> => {
        try {
            ipAbortRef.current?.abort();
            const outer = new AbortController();
            ipAbortRef.current = outer;

            const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
                const c = new AbortController();
                const abort = () => c.abort();
                let timer: number | null = null;
                try {
                    if (outer.signal.aborted) c.abort();
                    else outer.signal.addEventListener("abort", abort, { once: true });
                    timer = window.setTimeout(() => c.abort(), timeoutMs);
                    return await fetch(url, {
                        signal: c.signal,
                        headers: { Accept: "application/json" },
                        cache: "no-store",
                    });
                } finally {
                    if (timer != null) window.clearTimeout(timer);
                    try {
                        outer.signal.removeEventListener("abort", abort);
                    } catch {}
                }
            };

            const parseIpify = (txt: string): string | null => {
                try {
                    const parsed = JSON.parse(txt) as Partial<{ ip: string }>;
                    const v = typeof parsed.ip === "string" ? parsed.ip.trim() : "";
                    return v ? v : null;
                } catch {
                    return null;
                }
            };

            const tryFetchPublicIp = async (): Promise<string | null> => {
                // On iOS Safari (especially Private Browsing) first-time DNS/TLS can be slow.
                // Use dedicated timeouts and multiple endpoints for resilience.
                const endpoints = [
                    "https://api.ipify.org?format=json",
                    "https://api64.ipify.org?format=json",
                ];
                for (const url of endpoints) {
                    try {
                        const res = await fetchWithTimeout(url, 8000);
                        if (!res.ok) continue;
                        const txt = await res.text();
                        const ip = parseIpify(txt);
                        if (ip) return ip;
                    } catch {}
                }
                return null;
            };

            // Prefer the client public IP if possible (works in local dev and doesn't rely on forwarded headers).
            const ip = await tryFetchPublicIp();

            const url = ip ? `/api/ip-location?ip=${encodeURIComponent(ip)}` : "/api/ip-location";
            const res = await fetchWithTimeout(url, 12000);
            const text = await res.text();
            if (!text.trim()) return null;

            const parsed = JSON.parse(text) as Partial<
                | { ok: true; lat: number; lon: number; provider?: string; ipUsed?: string | null }
                | {
                    ok: false;
                    ipUsed?: string | null;
                    error?: { type?: string; message?: string; statusHint?: number };
                    tried?: Array<{ provider?: string; status?: number; message?: string; error?: string; url?: string }>;
                }
            >;

            if (parsed && (parsed as { ok?: unknown }).ok === true) {
                const lat = typeof (parsed as { lat?: unknown }).lat === "number" ? (parsed as { lat: number }).lat : Number.NaN;
                const lon = typeof (parsed as { lon?: unknown }).lon === "number" ? (parsed as { lon: number }).lon : Number.NaN;
                if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
                return null;
            }

            return null;
        } catch {
            return null;
        }
    }, []);

    // Resolve initial map center once. Prefer GPS (will trigger the permission prompt),
    // and fall back to IP location if GPS is unavailable or fails.
    useEffect(() => {
        if (startupCenter) return;
        if (typeof window === "undefined") return;
        if (suspendStartup) return;
        // Prevent double invocation in dev StrictMode from triggering multiple prompts.
        if (startupLastStartedAttemptRef.current === startupAttempt) return;
        startupLastStartedAttemptRef.current = startupAttempt;

        const reqId = ++startupReqIdRef.current;
        setStartupCenterError(null);
        setStartupManualError(null);

        void (async () => {
            const tryGeolocation = async (): Promise<{ lat: number; lon: number } | null> => {
                try {
                    if (!window.isSecureContext || !navigator.geolocation) return null;

                    const tryOnce = (opts: PositionOptions) =>
                        new Promise<GeolocationPosition>((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, opts);
                        });

                    // High accuracy can be flaky/time out; fall back to a more permissive request.
                    const pos = await tryOnce({
                        enableHighAccuracy: true,
                        timeout: 20_000,
                        maximumAge: 0,
                    }).catch(() =>
                        tryOnce({
                            enableHighAccuracy: false,
                            timeout: 25_000,
                            maximumAge: 10_000,
                        })
                    );
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                    return { lat, lon };
                } catch {
                    return null;
                }
            };

            const geo = await tryGeolocation();
            if (startupReqIdRef.current !== reqId) return;
            if (geo) {
                userLocationRef.current = { lat: geo.lat, lon: geo.lon };
                setUserLocation({ lat: geo.lat, lon: geo.lon });
                geoEverGrantedRef.current = true;
                setGeoPermission("granted");
                didCenterOnEnableRef.current = true;
                try {
                    window.dispatchEvent(
                        new CustomEvent("tankify:user-location", {
                            detail: { lat: geo.lat, lon: geo.lon },
                        })
                    );
                } catch {}
                setStartupCenter({ lat: geo.lat, lon: geo.lon, source: "gps" });
                return;
            }

            const ip = await fetchIpLocation();
            if (startupReqIdRef.current !== reqId) return;
            if (ip) {
                setStartupCenter({ lat: ip.lat, lon: ip.lon, source: "ip" });
                return;
            }

            setStartupCenterError("Standort konnte nicht bestimmt werden.");
        })();
    }, [startupCenter, startupAttempt, fetchIpLocation, suspendStartup]);

    const handleStartupManualSearch = useCallback(async () => {
        const q = startupManualQuery.trim();
        if (!q) return;
        setStartupManualLoading(true);
        setStartupManualError(null);
        try {
            // Cancel any in-flight startup attempt (GPS/IP).
            startupReqIdRef.current += 1;
            const point = await geocode(q);
            if (!point) {
                setStartupManualError("Ort nicht gefunden.");
                return;
            }

            setStartupCenterError(null);
            setStartupCenter({ lat: point.lat, lon: point.lon, source: "manual" });
        } catch (e) {
            if (e instanceof Error && e.message === "GEOCODE_FAILED") {
                setStartupManualError("Suche fehlgeschlagen. Bitte erneut versuchen.");
            } else {
                setStartupManualError("Suche fehlgeschlagen. Bitte erneut versuchen.");
            }
        } finally {
            setStartupManualLoading(false);
        }
    }, [startupManualQuery]);

    function upsertUserLocationMarker(map: MapLibreMap, loc: { lat: number; lon: number }) {
        const bucket = markerBucketRef.current;
        try {
            bucket.user?.remove?.();
        } catch {}
        bucket.user = null;

        try {
            const maplibre = getMapLibre();
            const el = createUserLocationElement();
            bucket.user = new maplibre.Marker({ element: el, anchor: "center" })
                .setLngLat([loc.lon, loc.lat])
                .addTo(map);
        } catch {}
    }

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
        if (!startupCenter) return;
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
                    center: [startupCenter.lon, startupCenter.lat],
                    zoom: DEFAULT_ZOOM,
                    attributionControl: false,
                    // Reduce console noise from strict style validation on remote styles.
                    // Also avoid internal resize tracking; we manage resize via a debounced ResizeObserver.
                    validateStyle: false,
                    trackResize: false,
                    dragRotate: false,
                    pitchWithRotate: false,
                    touchPitch: false,
                });
                mapRef.current = map;

                // Show attribution text without the compact "i" button.
                try {
                    if (maplibre.AttributionControl && typeof map.addControl === "function") {
                        map.addControl(
                            new maplibre.AttributionControl({ compact: true }),
                            "bottom-left"
                        );
                    }
                } catch {}

                const onMoveStart = () => {
                    setNeedsSearchHere(true);
                    const label = searchHereSeenRef.current
                        ? t.route.searchHere
                        : t.route.searchHereLong ?? t.route.searchHere;
                    setSearchHint(getAreaChangedHint(t, label));
                };
                const onMoveStartAny = (e: unknown) => {
                    onMoveStart();
                    // Any manual pan/zoom should stop "auto-fit" snap-backs until an explicit recenter happens.
                    suppressAutoFitRef.current = true;
                    const isUserInitiated = Boolean((e as { originalEvent?: unknown } | null)?.originalEvent);
                    if (isUserInitiated) {
                        setHideSearchOverlay(false);
                    }
                };
                map.on("movestart", onMoveStartAny);
                map.on("zoomstart", onMoveStartAny);

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

                    // If geolocation resolves before the map is ready, the "user marker" effect can miss.
                    // Ensure the marker is created once the map finishes loading.
                    try {
                        const loc = userLocationRef.current;
                        if (locationEnabledRef.current && loc) {
                            upsertUserLocationMarker(map, loc);
                        }
                    } catch {}
                });

                const ro = new ResizeObserver(() => {
                    // Debounce: while panels animate, the map container height changes a few times.
                    // We want to re-apply a pending recenter once the size has stabilized.

                    // Make the map repaint during layout transitions (panel collapse/expand),
                    // otherwise the container grows/shrinks but MapLibre only redraws after our debounce,
                    // which looks like a "white box" trailing behind the panels.
                    if (resizeRafRef.current == null) {
                        resizeRafRef.current = window.requestAnimationFrame(() => {
                            resizeRafRef.current = null;
                            safeResizePreserveView(map, container);
                        });
                    }

                    if (resizeDebounceTimerRef.current != null) {
                        window.clearTimeout(resizeDebounceTimerRef.current);
                        resizeDebounceTimerRef.current = null;
                    }

                    resizeDebounceTimerRef.current = window.setTimeout(() => {
                        resizeDebounceTimerRef.current = null;

                        // If the container is currently collapsed (0x0) during a layout transition,
                        // calling resize/fitBounds can put MapLibre into a bad internal state.
                        safeResizePreserveView(map, container);

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
                        // Snap (no animation) after resize settle to avoid "shaking" during panel transitions.
                        try {
                            recenterToPoints(map, pending, 0, viewportBottomInsetRef.current);
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
                    if (resizeRafRef.current != null) {
                        window.cancelAnimationFrame(resizeRafRef.current);
                        resizeRafRef.current = null;
                    }
                    if (pendingRecenterClearTimerRef.current != null) {
                        window.clearTimeout(pendingRecenterClearTimerRef.current);
                        pendingRecenterClearTimerRef.current = null;
                    }
                    map.off("movestart", onMoveStartAny);
                    map.off("zoomstart", onMoveStartAny);
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
    }, [startupCenter]);

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
        // Only auto-fit when we have a calculated route geometry.
        // Start/end selection alone should not force recentering.
        if (validRoute.length === 0) return;
        const points = validRoute;
        const signature = (() => {
            const first = validRoute[0];
            const last = validRoute[validRoute.length - 1];
            return `r:${validRoute.length}:${first[0]},${first[1]}:${last[0]},${last[1]}`;
        })();

        // Prevent auto-recentering on unrelated re-renders (e.g. "Hier suchen" updates stations state).
        if (lastAutoFitSignatureRef.current === signature) return;
        lastAutoFitSignatureRef.current = signature;
        // A new calculated route is an explicit user action ("Calculate"/auto-calc), so allow auto-fit
        // even if the user previously panned/zoomed the map.
        suppressAutoFitRef.current = false;

        if (points.length === 0) return;

        try {
            // When we auto-recenter for a calculated route (geometry may arrive slightly later),
            // hide the overlay until the user moves the map or the map resizes.
            setHideSearchOverlay(true);

            // Apply immediately, but also re-apply once after any layout-driven resize settles.
            setPendingRecenter(points);
            window.requestAnimationFrame(() => {
                try {
                    map.resize();
                } catch {}
                try {
                    recenterToPoints(map, points, 650, viewportBottomInsetRef.current);
                } catch {}
            });
        } catch {}
    }, [routeGeometry]);

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
            const badgeText = hasPrice
                ? formatBadgePrice(selectedPrice, measurementSystem, currencySystem, eurToCurrencyRate)
                : null;

            const el = createStationMarkerElement({ station, hasPrice, badgeText, logoCacheBust });
            el.dataset.stationId = station.id;
            el.addEventListener("click", (ev) => {
                ev.stopPropagation();
                onStationSelectRef.current?.(station);
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
        currencySystem,
        eurToCurrencyRate,
        logoCacheBust,
        applyStationMarkerVisibility,
    ]);

    // Highlight and center the selected station (no popups; selection is shown in the UI list).
    const lastStationRecenterRef = useRef<{ id: string | null; focus: number }>({
        id: null,
        focus: -1,
    });
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
        const focus = typeof stationFocusRequestId === "number" ? stationFocusRequestId : 0;
        const last = lastStationRecenterRef.current;
        // Don't recenter repeatedly just because the stations array identity/order changes.
        if (last.id === selectedStationId && last.focus === focus) return;

        const points: Array<[number, number]> = [[station.lat, station.lon]];
        try {
            suppressAutoFitRef.current = false;
            lastStationRecenterRef.current = { id: selectedStationId, focus };
            // When side panels open/close, ResizeObserver may call map.stop() and cancel animations.
            // Keep a pending recenter so we re-apply after the resize settles.
            setPendingRecenter(points);
            window.requestAnimationFrame(() => {
                try {
                    recenterToPoints(map, points, 650, viewportBottomInsetRef.current);
                } catch {}
            });
        } catch {}
    }, [selectedStationId, stations, stationFocusRequestId]);

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

        const bucket = markerBucketRef.current;
        try {
            bucket.user?.remove?.();
        } catch {}
        bucket.user = null;

        if (locationEnabled && userLocation) {
            upsertUserLocationMarker(map, userLocation);
        }
    }, [locationEnabled, userLocation]);

    // Geolocation watch.
    useEffect(() => {
        const map = mapRef.current;

        // Avoid triggering a second geolocation prompt during initial startup center resolution.
        if (!startupCenter) return;

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

                geoEnableUserGestureRef.current = false;
                geoEverGrantedRef.current = true;
                geoDeniedConfirmedRef.current = false;
                setGeoPermission("granted");
                userLocationRef.current = { lat, lon };
                setUserLocation({ lat, lon });
                setLocationError(null);
                try {
                    window.dispatchEvent(
                        new CustomEvent("tankify:user-location", { detail: { lat, lon } })
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
                const code = (err as GeolocationPositionError | undefined)?.code;
                if (code === 1) {
                    if (!geoEnableUserGestureRef.current && !geoEverGrantedRef.current) {
                        geoEnableUserGestureRef.current = false;
                        setGeoPermission("prompt");
                        setLocationEnabled(false);
                        setLocationError(
                            'Standort konnte nicht automatisch aktiviert werden. Bitte tippen Sie auf "Standort einschalten" und erlauben Sie den Zugriff in Safari.'
                        );
                        return;
                    }

                    geoEnableUserGestureRef.current = false;
                    geoDeniedConfirmedRef.current = true;
                    setGeoPermission("denied");
                    setLocationEnabled(false);
                    setLocationError(
                        "Standort ist deaktiviert. Bitte in den Browser-Einstellungen aktivieren."
                    );
                    return;
                }

                setLocationError(err.message || "Location error");
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                if (code !== 1) {
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
    }, [startupCenter, locationEnabled, locationAttempt]);

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

        onSearchHereStart?.();

        // After the first usage, keep the label short for this user.
        if (!searchHereSeenRef.current) {
            try {
                window.localStorage.setItem(SEARCH_HERE_SEEN_KEY, "1");
            } catch {}
            searchHereSeenRef.current = true;
            setSearchHereSeen(true);
        }

        setSearchLoading(true);
        setNeedsSearchHere(false);
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

    const handleRecenter = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;
        suppressAutoFitRef.current = false;

        const geom = routeGeometryRef.current;
        const s = startRef.current;
        const e = endRef.current;

        const validRoute = geom.filter(
            (p) => isFiniteNumber(p[0]) && isFiniteNumber(p[1])
        );
        const rawPoints =
            validRoute.length > 0
                ? validRoute
                : [
                      ...(s ? [sanitizeLatLng([s.lat, s.lon])] : []),
                      ...(e ? [sanitizeLatLng([e.lat, e.lon])] : []),
                  ];
        const points = rawPoints.filter((p): p is [number, number] => p !== null);
        if (points.length === 0) return;
        try {
            // If a layout transition resizes the map right after recentering,
            // the resulting view can look "off". Keep one pending recenter to re-apply after resize.
            setPendingRecenter(points);

            // Apply immediately too, but after a resize tick.
            window.requestAnimationFrame(() => {
                const container = containerRef.current;
                if (container) safeResizePreserveView(map, container);
                try {
                    recenterToPoints(map, points, 650, viewportBottomInsetRef.current);
                } catch {}
            });
        } catch {}
    }, []);

    useEffect(() => {
        if (typeof recenterRequestId !== "number" || recenterRequestId <= 0) return;
        handleRecenter();
    }, [recenterRequestId, handleRecenter]);

    function canUseGeolocation(): boolean {
        return geoAvailable;
    }

    useEffect(() => {
        const label = searchHereSeenRef.current
            ? t.route.searchHere
            : t.route.searchHereLong ?? t.route.searchHere;
        setSearchHint(getTapSearchHereHint(t, label));
        setNeedsSearchHere(true);
    }, [t, searchHereSeen]);

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="h-full w-full" />

            {!startupCenter && !suspendStartup ? (
                <div className="absolute inset-0 z-2000 grid place-items-center bg-white">
                    <div className="mx-6 max-w-sm rounded-3xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                        <div className="text-sm font-semibold text-gray-900">
                            Standort wird ermittelt...
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                            Bitte Standortzugriff erlauben.
                        </div>
                        {startupCenterError ? (
                            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900">
                                {startupCenterError}
                            </div>
                        ) : null}
                        {startupCenterError ? (
                            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900">
                                Entweder aktivieren sie ihren standort oder geben sie einen standort ein
                                <form
                                    className="mt-2 flex gap-2"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        void handleStartupManualSearch();
                                    }}
                                >
                                    <input
                                        value={startupManualQuery}
                                        onChange={(e) => setStartupManualQuery(e.target.value)}
                                        placeholder="Ort eingeben (z.B. Wien)"
                                        className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                                        autoCapitalize="sentences"
                                        autoCorrect="on"
                                        inputMode="search"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!startupManualQuery.trim() || startupManualLoading}
                                        className={
                                            "shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm active:scale-[0.99] " +
                                            (!startupManualQuery.trim() || startupManualLoading
                                                ? "bg-gray-200 text-gray-600"
                                                : "bg-blue-600 text-white hover:bg-blue-700")
                                        }
                                    >
                                        {startupManualLoading ? "Suchen..." : "Suchen"}
                                    </button>
                                </form>
                                {startupManualError ? (
                                    <div className="mt-2 text-[11px] font-semibold text-red-700">
                                        {startupManualError}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        {startupCenterError ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setStartupCenterError(null);
                                    setStartupManualError(null);
                                    startupReqIdRef.current += 1;
                                    setStartupAttempt((v) => v + 1);
                                }}
                                className="mt-3 w-full rounded-2xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
                            >
                                Erneut versuchen
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}

            <div className="pointer-events-none absolute left-3 top-3 z-1000 flex flex-col gap-2">
                <button
                    type="button"
                    onClick={handleRecenter}
                    aria-label={t.route.center}
                    title={t.route.center}
                    className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white text-gray-900 shadow-lg transition hover:bg-gray-50 active:scale-95"
                >
                    <svg
                        viewBox="0 0 24 24"
                        className="h-6 w-6"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <path
                            d="M12 2v3M12 19v3M2 12h3M19 12h3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <circle
                            cx="12"
                            cy="12"
                            r="5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        />
                        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                    </svg>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        if (!canUseGeolocation()) {
                            setLocationError(
                                typeof window !== "undefined" && !window.isSecureContext
                                    ? "Geolocation requires HTTPS (or localhost)."
                                    : "Geolocation not available."
                            );
                            return;
                        }

                        // If we *know* permission is denied (confirmed via geolocation error code=1),
                        // we can't trigger a prompt. Show a clear hint instead.
                        if (
                            !locationEnabled &&
                            geoPermission === "denied" &&
                            geoDeniedConfirmedRef.current
                        ) {
                            setLocationError(
                                "Standort ist deaktiviert. Bitte in den Browser-Einstellungen aktivieren."
                            );
                            return;
                        }

                        // Clear stale errors when user explicitly retries.
                        if (!locationEnabled) setLocationError(null);
                        if (!locationEnabled) geoEnableUserGestureRef.current = true;
                        setLocationEnabled((v) => !v);
                    }}
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
                    aria-disabled={!canUseGeolocation()}
                    className={
                        "pointer-events-auto relative grid h-11 w-11 place-items-center rounded-full shadow-lg transition active:scale-95 " +
                        (locationEnabled
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-white text-gray-900 hover:bg-gray-50") +
                        (!canUseGeolocation() ? " opacity-60 cursor-not-allowed" : "")
                    }
                >
                    <svg
                        viewBox="0 0 24 24"
                        className="h-6 w-6"
                        aria-hidden="true"
                        focusable="false"
                    >
                        {/* Location pointer (GPS-style) */}
                        <path
                            d="M12 2l7 19-7-3-7 3 7-19z"
                            fill="currentColor"
                        />
                    </svg>
                </button>
            </div>

            {locationError ? (
                <div className="pointer-events-none absolute right-3 top-16 z-1000 max-w-[70vw] rounded-2xl border border-gray-200 bg-white/90 px-3 py-2 text-[11px] font-semibold text-gray-900 shadow-lg backdrop-blur md:right-4 md:top-20 md:max-w-sm md:text-xs">
                    {locationError}
                </div>
            ) : null}

            {!hideSearchOverlay ? (
                <div className="pointer-events-none absolute bottom-1/12 left-1/2 z-1000 -translate-x-1/2 md:bottom-1">
                    <div className="flex flex-col items-center gap-1">
                        {(() => {
                            const label = searchHereSeen ? t.route.searchHere : (t.route.searchHereLong ?? t.route.searchHere);
                            return (
                                <button
                                    type="button"
                                    onClick={handleSearchHere}
                                    aria-label={label}
                                    title={label}
                                    className={
                                        "pointer-events-auto flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 active:scale-95 " +
                                        (!searchLoading && needsSearchHere
                                            ? "ring-4 ring-blue-200 ring-offset-2 ring-offset-white"
                                            : "")
                                    }
                                >
                                    <svg
                                        viewBox="0 0 20 20"
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                        focusable="false"
                                    >
                                        <path
                                            d="M12.5 12.5l4 4"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                        <circle
                                            cx="8.5"
                                            cy="8.5"
                                            r="5.5"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        />
                                    </svg>
                                    {searchLoading ? t.route.loading : label}
                                </button>
                            );
                        })()}

                        <div className="w-72 rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-center text-[11px] text-gray-800 shadow backdrop-blur md:w-auto md:text-xs">
                            {searchHint}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
