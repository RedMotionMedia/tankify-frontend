"use client";

import L, { type LeafletMouseEvent } from "leaflet";
import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    MapContainer,
    Marker,
    Polyline,
    Popup,
    useMap,
    useMapEvents,
} from "react-leaflet";
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
import { kmToMiles, pricePerLiterToPerGallon } from "@/lib/units";

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

function isNearKm(
    a: { lat: number; lon: number },
    b: { lat: number; lon: number },
    km: number
) {
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) return false;
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lon)) return false;
    return haversineKm({ lat: a.lat, lon: a.lon }, b) <= km;
}

const startPointIcon = L.divIcon({
    className: "route-point-marker route-point-marker--start",
    html: `<div class="route-point"><span class="route-point__label">S</span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -18],
});

const endPointIcon = L.divIcon({
    className: "route-point-marker route-point-marker--end",
    html: `<div class="route-point"><span class="route-point__label">Z</span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -18],
});

const stationIconCache = new Map<string, L.DivIcon>();

const OPENFREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const FALLBACK_VIEW = { center: [48.3069, 14.2858] as [number, number], zoom: 9 };

const userLocationIcon = L.divIcon({
    className: "user-location-marker",
    html: `
<div class="user-location" aria-hidden="true">
  <div class="user-location__pulse"></div>
  <div class="user-location__dot"></div>
</div>
`.trim(),
    iconSize: [20, 20],
    iconAnchor: [10, 10],
});

function isFiniteNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

function sanitizeLatLng(center: [number, number]): [number, number] {
    return isFiniteNumber(center[0]) && isFiniteNumber(center[1]) ? center : FALLBACK_VIEW.center;
}

function withCacheBuster(url: string, cacheBust: number): string {
    if (!url) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${cacheBust}`;
}

function haversineKm(a: UserLocation, b: { lat: number; lon: number }): number {
    // Haversine distance in km.
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

function isPointAtAnyStation(
    point: { lat: number; lon: number },
    stations: Station[],
    km = 0.03
): boolean {
    return stations.some((s) => isNearKm(point, s, km));
}

let openFreeMapDepsPromise: Promise<void> | null = null;
type LeafletMapLibreFactory = (options: { style: string }) => L.Layer;
type MapLibreStyleImageMissingEvent = { id: string };
type MapLibreMapLike = {
    on: (type: "styleimagemissing", listener: (ev: MapLibreStyleImageMissingEvent) => void) => void;
    off: (
        type: "styleimagemissing",
        listener: (ev: MapLibreStyleImageMissingEvent) => void
    ) => void;
    hasImage: (id: string) => boolean;
    addImage: (
        id: string,
        image: { width: number; height: number; data: Uint8Array }
    ) => void;
};
type LeafletMapLibreLayerLike = L.Layer & { getMaplibreMap?: () => MapLibreMapLike };

function whenLeafletReady(map: L.Map): Promise<void> {
    if ((map as unknown as { _loaded?: boolean })._loaded) return Promise.resolve();
    return new Promise<void>((resolve) => map.whenReady(() => resolve()));
}

function isLeafletSizeAndCenterValid(map: L.Map): boolean {
    try {
        const size = map.getSize();
        if (!(size.x > 0 && size.y > 0)) return false;
        const c = map.getCenter(); // can throw while Leaflet is mid-init
        return Number.isFinite(c.lat) && Number.isFinite(c.lng);
    } catch {
        return false;
    }
}

function loadScriptOnce(id: string, src: string): Promise<void> {
    if (typeof document === "undefined") {
        return Promise.reject(new Error("loadScriptOnce called without document"));
    }

    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === "1") return Promise.resolve();

    if (existing) {
        return new Promise<void>((resolve, reject) => {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error(`script failed: ${src}`)), {
                once: true,
            });
        });
    }

    return new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.id = id;
        s.src = src;
        s.async = true;
        s.addEventListener("load", () => {
            s.dataset.loaded = "1";
            resolve();
        });
        s.addEventListener("error", () => reject(new Error(`script failed: ${src}`)));
        document.head.appendChild(s);
    });
}

function ensureOpenFreeMapDeps(): Promise<void> {
    if (openFreeMapDepsPromise) return openFreeMapDepsPromise;

    openFreeMapDepsPromise = (async () => {
        // The UMD bundle of leaflet-maplibre-gl expects globals.
        (window as unknown as { L?: unknown }).L = L;

        // Order matters: the Leaflet binding expects `maplibregl` to exist.
        await loadScriptOnce(
            "tankify-maplibre-gl",
            "https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"
        );
        await loadScriptOnce(
            "tankify-maplibre-gl-leaflet",
            "https://unpkg.com/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js"
        );
    })();

    return openFreeMapDepsPromise;
}

function getStationInitials(name: string | undefined): string {
    const value = (name ?? "").trim();
    if (!value) return "?";

    const parts = value.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "?";
    const second = parts[1]?.[0] ?? "";
    return (first + second).toUpperCase();
}

function escapeHtmlAttr(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("\"", "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function getStationDivIcon(
    station: Station,
    hasPrice: boolean,
    logoCacheBust: number
): L.DivIcon {
    const size = 34;
    const logoUrl = station.logoUrl ? withCacheBuster(station.logoUrl, logoCacheBust) : "";
    const initials = getStationInitials(station.brandName ?? station.name);
    const key = `${hasPrice ? "p1" : "p0"}|${logoUrl || initials}`;

    const cached = stationIconCache.get(key);
    if (cached) return cached;

    const ringClass = hasPrice ? "station-logo--ok" : "station-logo--missing";
    const img = logoUrl
        ? `<img class="station-logo__img" src="${escapeHtmlAttr(logoUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'" />`
        : "";

    const icon = L.divIcon({
        className: "station-logo-marker",
        html: `
<div class="station-logo ${ringClass}">
  <div class="station-logo__fallback">${escapeHtmlAttr(initials)}</div>
  ${img}
</div>
`.trim(),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -(size / 2)],
    });

    stationIconCache.set(key, icon);
    return icon;
}

function formatDisplayPrice(
    value: number | null | undefined,
    measurementSystem: MeasurementSystem,
    currencySystem: CurrencySystem
) {
    if (value === null || value === undefined) return "—";

    const converted =
        measurementSystem === "metric"
            ? value
            : pricePerLiterToPerGallon(value);

    const symbol = currencySystem === "eur" ? "€" : "$";
    const unit = measurementSystem === "metric" ? "/L" : "/gal";

    return `${converted.toFixed(3)} ${symbol}${unit}`;
}

function formatBadgePrice(
    value: number | null | undefined,
    measurementSystem: MeasurementSystem
) {
    if (value === null || value === undefined) return null;

    const converted =
        measurementSystem === "metric"
            ? value
            : pricePerLiterToPerGallon(value);

    return converted.toFixed(3);
}

const WEEKDAY_ORDER = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"] as const;

function jsDayToEcontrolCode(jsDay: number): (typeof WEEKDAY_ORDER)[number] {
    // JS: 0=Sun ... 6=Sat
    if (jsDay === 0) return "SO";
    if (jsDay === 1) return "MO";
    if (jsDay === 2) return "DI";
    if (jsDay === 3) return "MI";
    if (jsDay === 4) return "DO";
    if (jsDay === 5) return "FR";
    return "SA";
}

function weekdayLabel(code: string, language: Language): string {
    const idx = WEEKDAY_ORDER.indexOf(code as (typeof WEEKDAY_ORDER)[number]);
    if (idx === -1) return code;

    // 2020-01-06 was a Monday; use UTC to avoid timezone drift.
    const d = new Date(Date.UTC(2020, 0, 6 + idx));
    const locale = language === "de" ? "de-AT" : "en-US";
    return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d);
}

function normalizeWebsiteUrl(url: string): string {
    return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
}

function is24Hours(from: string | null, to: string | null): boolean {
    if (!from || !to) return false;
    if (from !== "00:00") return false;
    return to === "24:00" || to === "00:00";
}

function ClickHandler({
                          pickMode,
                          onMapPick,
                      }: {
    pickMode: MapPickMode;
    onMapPick: (type: "start" | "end", point: Point) => void;
}) {
    useMapEvents({
        async click(e: LeafletMouseEvent) {
            if (!pickMode) return;

            const lat = e.latlng.lat;
            const lon = e.latlng.lng;
            const label = await reverseGeocode(lat, lon);

            onMapPick(pickMode, { lat, lon, label });
        },
    });

    return null;
}

function FitBounds({
                        start,
                        end,
                        routeGeometry,
                    }: {
    start: Point;
    end: Point;
    routeGeometry: [number, number][];
}) {
    const map = useMap();

    useEffect(() => {
        const validRoute = routeGeometry.filter(
            (p) => isFiniteNumber(p[0]) && isFiniteNumber(p[1])
        );
        const points =
            validRoute.length > 0
                ? validRoute
                : [
                    sanitizeLatLng([start.lat, start.lon]),
                    sanitizeLatLng([end.lat, end.lon]),
                ];

        map.fitBounds(points as [number, number][], { padding: [30, 30] });
    }, [map, start, end, routeGeometry]);

    return null;
}

function SearchHereControl({
                                onStationsLoaded,
                                debugMode,
                                t,
                            }: {
    onStationsLoaded: (stations: Station[]) => void;
    debugMode: boolean;
    t: TranslationSchema;
}) {
    const map = useMap();
    const [loading, setLoading] = useState(false);
    const [hint, setHint] = useState<string>(t.route.tapSearchHere);

    useEffect(() => {
        setHint(t.route.tapSearchHere);
    }, [t]);

    useEffect(() => {
        function onMoveStart() {
            setHint(t.route.areaChanged);
        }

        map.on("movestart", onMoveStart);
        map.on("zoomstart", onMoveStart);

        return () => {
            map.off("movestart", onMoveStart);
            map.off("zoomstart", onMoveStart);
        };
    }, [map, t]);

    async function handleSearchHere() {
        const currentZoom = map.getZoom();

        if (currentZoom < 13) {
            setHint(t.route.zoomInMore);
            onStationsLoaded([]);
            return;
        }

        setLoading(true);
        setHint(t.route.stationsLoading);

        try {
            const bounds = map.getBounds();
            const center = map.getCenter();

            const result = await fetchStationsForVisibleMap({
                south: bounds.getSouth(),
                west: bounds.getWest(),
                north: bounds.getNorth(),
                east: bounds.getEast(),
                centerLat: center.lat,
                centerLon: center.lng,
            }, { debug: debugMode });

            onStationsLoaded(result.stations as Station[]);

            if (result.error) {
                setHint(result.error);
            } else {
                setHint(
                    result.stations.length > 0
                        ? `${result.stations.length} ${t.route.stationsLoaded}`
                        : t.route.noStationsFound
                );
            }
        } catch {
            onStationsLoaded([]);
            setHint(t.route.stationsLoadFailed);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="pointer-events-none absolute bottom-1/12 left-1/2 z-1000 -translate-x-1/2 md:bottom-1">
            <div className="flex flex-col items-center gap-1">
                <button
                    type="button"
                    onClick={handleSearchHere}
                    className="pointer-events-auto rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 active:scale-95"
                >
                    {loading ? t.route.loading : t.route.searchHere}
                </button>

                <div className="w-65 rounded-full bg-white/50 px-3 py-1 text-center text-[10px] text-gray-700 shadow md:w-auto md:text-xs">
                    {hint}
                </div>
            </div>
        </div>
    );
}

function PriceBadge({
                        station,
                        fuelType,
                        measurementSystem,
                    }: {
    station: Station;
    fuelType: FuelType;
    measurementSystem: MeasurementSystem;
}) {
    const value = fuelType === "diesel" ? station.diesel : station.super95;
    const badgeText = formatBadgePrice(value, measurementSystem);
    if (!badgeText) return null;

    return (
        <Marker
            position={[station.lat, station.lon]}
            interactive={false}
            icon={L.divIcon({
                className: "price-badge-marker",
                html: `<div class="price-badge-inner">${badgeText}</div>`,
                iconSize: [56, 24],
                iconAnchor: [28, 46],
            })}
        />
    );
}

function StationPopupContent({
    station,
    selectedPrice,
    fuelType,
    measurementSystem,
    currencySystem,
    language,
    debugMode,
    logoCacheBust,
    t,
    onSelectStationAsStart,
    onSelectStationAsDestination,
}: {
    station: Station;
    selectedPrice: number | null | undefined;
    fuelType: FuelType;
    measurementSystem: MeasurementSystem;
    currencySystem: CurrencySystem;
    language: Language;
    debugMode: boolean;
    logoCacheBust: number;
    t: TranslationSchema;
    onSelectStationAsStart: (payload: {
        point: Point;
        price?: number | null;
        station: Station;
    }) => void;
    onSelectStationAsDestination: (payload: {
        point: Point;
        price?: number | null;
        station: Station;
    }) => void;
}) {
    const initials = getStationInitials(station.brandName ?? station.name);
    const openingHours = Array.isArray(station.openingHours) ? station.openingHours : [];
    const logoUrl = station.logoUrl ? withCacheBuster(station.logoUrl, logoCacheBust) : null;

    const openingHoursByDay = new Map<string, Array<{ from: string | null; to: string | null }>>();
    for (const h of openingHours) {
        const day = String(h.day ?? "").trim();
        if (!day) continue;
        const list = openingHoursByDay.get(day) ?? [];
        list.push({ from: h.from ?? null, to: h.to ?? null });
        openingHoursByDay.set(day, list);
    }

    const today = jsDayToEcontrolCode(new Date().getDay());
    const todayIdx = WEEKDAY_ORDER.indexOf(today);
    const rotatedWeekdays =
        todayIdx === -1
            ? [...WEEKDAY_ORDER]
            : [...WEEKDAY_ORDER.slice(todayIdx), ...WEEKDAY_ORDER.slice(0, todayIdx)];

    return (
        <div className="w-85 max-w-[70vw] select-text">
            <div className="flex items-start gap-3">
                <div
                    className={
                        `relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 bg-white shadow-sm ${
                            selectedPrice != null ? "station-logo--ok" : "station-logo--missing"
                        }`
                    }
                >
                    <div className="absolute inset-0 grid place-items-center text-xs font-extrabold tracking-tight text-gray-700">
                        {initials}
                    </div>
                    {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={logoUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 h-full w-full rounded-full object-contain"
                            onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                        />
                    ) : null}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-extrabold tracking-tight text-gray-900">
                        {station.name}
                    </div>

                    <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                        {station.address ? <div>{station.address}</div> : null}
                        {station.postalCode || station.city ? (
                            <div className="text-gray-500">
                                {(station.postalCode ? `${station.postalCode} ` : "") +
                                    (station.city ?? "")}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>


            <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">

                {station.distanceKm != null ? (
                    <span className=" rounded-full bg-gray-50 px-2 py-0.5 font-medium text-gray-600 ring-1 ring-gray-200">
                                {t.station.distance}:{" "}
                        {(measurementSystem === "imperial"
                                ? kmToMiles(station.distanceKm)
                                : station.distanceKm
                        ).toFixed(2)}{" "}
                        {measurementSystem === "imperial" ? t.units.miles : t.units.km}
                            </span>
                ) : null}

                <div className="flex-auto">

                </div>
                <span className="font-medium text-gray-500">
                            {t.pricing.dataSource}
                        </span>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 ring-1 ring-blue-200">
                            <Image
                                src="/resources/logos/econtrol.svg"
                                alt="E-Control"
                                width={47}
                                height={14}
                                className="h-3.5 w-auto"
                                loading="lazy"
                                unoptimized
                            />
                        </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-gray-200 bg-linear-to-b from-gray-50 to-white p-3">
                    <div className="text-[11px] font-semibold text-gray-600">
                        {t.pricing.diesel}
                    </div>
                    <div className="mt-0.5 text-sm font-extrabold text-gray-900">
                        {formatDisplayPrice(
                            station.diesel,
                            measurementSystem,
                            currencySystem
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-linear-to-b from-gray-50 to-white p-3">
                    <div className="text-[11px] font-semibold text-gray-600">{t.pricing.super95}</div>
                    <div className="mt-0.5 text-sm font-extrabold text-gray-900">
                        {formatDisplayPrice(
                            station.super95,
                            measurementSystem,
                            currencySystem
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-3 rounded-2xl bg-blue-50 px-3 py-2 text-xs text-blue-900 ring-1 ring-blue-100">
                <div className="font-semibold">
                    {t.pricing.selectedFuel}:{" "}
                    {fuelType === "diesel" ? t.pricing.diesel : t.pricing.super95}
                </div>
                <div className="mt-0.5 text-[11px] text-blue-800">
                    {t.pricing.sourcePrice}:{" "}
                    <span className="font-bold">
                        {formatDisplayPrice(
                            selectedPrice,
                            measurementSystem,
                            currencySystem
                        )}
                    </span>
                </div>
            </div>

            <div className="mt-3 grid gap-2">
                <details className="group rounded-2xl border border-gray-200 bg-white px-3 py-2">
                    <summary className="flex list-none items-center gap-2 text-xs font-semibold text-gray-700">
                        <span
                            aria-hidden="true"
                            className="text-gray-500 transition-transform group-open:rotate-90"
                        >
                            ▶
                        </span>
                        <span className="flex-auto">{t.station.openingHours}</span>
                        <span
                            className={
                                "rounded-full px-2 py-0.5 font-semibold " +
                                (station.open === true
                                    ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                                    : station.open === false
                                        ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                                        : "bg-gray-50 text-gray-600 ring-1 ring-gray-200")
                            }
                        >
                            {station.open === true
                                ? t.station.open
                                : station.open === false
                                    ? t.station.closed
                                    : t.station.unknown}
                        </span>
                    </summary>

                    {openingHours.length ? (
                        <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs text-gray-700">
                            {rotatedWeekdays.map((code) => {
                                const isToday = code === today;
                                const intervals = openingHoursByDay.get(code) ?? [];
                                const has24 = intervals.some((x) => is24Hours(x.from, x.to));
                                const value = has24
                                    ? t.station.open24Hours
                                    : intervals.length
                                        ? intervals
                                            .map((x) =>
                                                x.from && x.to ? `${x.from}\u2013${x.to}` : "—"
                                            )
                                            .join(", ")
                                        : "—";

                                return (
                                    <React.Fragment key={code}>
                                        <div
                                            className={
                                                isToday
                                                    ? "font-bold text-gray-900"
                                                    : "text-gray-600"
                                            }
                                        >
                                            {weekdayLabel(code, language)}
                                        </div>
                                        <div
                                            className={
                                                "text-right tabular-nums " +
                                                (isToday
                                                    ? "font-bold text-gray-900"
                                                    : "font-medium text-gray-700")
                                            }
                                        >
                                            {value}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-gray-500">—</div>
                    )}
                </details>

                <details className="group rounded-2xl border border-gray-200 bg-white px-3 py-2">
                    <summary className="flex list-none items-center gap-2 text-xs font-semibold text-gray-700">
                        <span
                            aria-hidden="true"
                            className="text-gray-500 transition-transform group-open:rotate-90"
                        >
                            ▶
                        </span>
                        <span className="flex-auto">{t.station.payment}</span>
                    </summary>
                    {station.paymentMethods?.cash ||
                    station.paymentMethods?.debitCard ||
                    station.paymentMethods?.creditCard ||
                    (station.paymentMethods?.others ?? "").trim() ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                            {station.paymentMethods?.cash ? (
                                <span className="rounded-full bg-gray-50 px-2 py-0.5 font-semibold text-gray-700 ring-1 ring-gray-200">
                                    {t.station.paymentCash}
                                </span>
                            ) : null}
                            {station.paymentMethods?.debitCard ? (
                                <span className="rounded-full bg-gray-50 px-2 py-0.5 font-semibold text-gray-700 ring-1 ring-gray-200">
                                    {t.station.paymentDebitCard}
                                </span>
                            ) : null}
                            {station.paymentMethods?.creditCard ? (
                                <span className="rounded-full bg-gray-50 px-2 py-0.5 font-semibold text-gray-700 ring-1 ring-gray-200">
                                    {t.station.paymentCreditCard}
                                </span>
                            ) : null}
                            {(station.paymentMethods?.others ?? "")
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean)
                                .map((method, idx) => (
                                    <span
                                        key={`${method}-${idx}`}
                                        className="rounded-full bg-gray-50 px-2 py-0.5 font-semibold text-gray-700 ring-1 ring-gray-200"
                                    >
                                        {method}
                                    </span>
                                ))}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-gray-500">—</div>
                    )}
                </details>

                <details className="group rounded-2xl border border-gray-200 bg-white px-3 py-2">
                    <summary className="flex list-none items-center gap-2 text-xs font-semibold text-gray-700">
                        <span
                            aria-hidden="true"
                            className="text-gray-500 transition-transform group-open:rotate-90"
                        >
                            ▶
                        </span>
                        <span className="flex-auto">{t.station.contact}</span>
                    </summary>
                    {station.contact?.telephone ||
                    station.contact?.fax ||
                    station.contact?.mail ||
                    station.contact?.website ? (
                        <div className="mt-2 space-y-1 text-xs text-gray-700">
                            {station.contact?.telephone ? (
                                <div>
                                    <span className="font-medium">{t.station.phone}:</span>{" "}
                                    <a href={`tel:${station.contact.telephone}`} className="underline">
                                        {station.contact.telephone}
                                    </a>
                                </div>
                            ) : null}
                            {station.contact?.fax ? (
                                <div>
                                    <span className="font-medium">{t.station.fax}:</span>{" "}
                                    <span className="tabular-nums">{station.contact.fax}</span>
                                </div>
                            ) : null}
                            {station.contact?.mail ? (
                                <div>
                                    <span className="font-medium">{t.station.mail}:</span>{" "}
                                    <a href={`mailto:${station.contact.mail}`} className="underline">
                                        {station.contact.mail}
                                    </a>
                                </div>
                            ) : null}
                            {station.contact?.website ? (
                                <div>
                                    <span className="font-medium">{t.station.website}:</span>{" "}
                                    <a
                                        href={normalizeWebsiteUrl(station.contact.website)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="underline"
                                    >
                                        {station.contact.website}
                                    </a>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-gray-500">—</div>
                    )}
                </details>

                {station.otherServiceOffers ? (
                    <details className="group rounded-2xl border border-gray-200 bg-white px-3 py-2">
                        <summary className="flex list-none items-center gap-2 text-xs font-semibold text-gray-700">
                            <span
                                aria-hidden="true"
                                className="text-gray-500 transition-transform group-open:rotate-90"
                            >
                                ▶
                            </span>
                            <span className="flex-auto">{t.station.otherOffers}</span>
                        </summary>
                        <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-2 text-[11px] leading-snug text-gray-700">
                            {station.otherServiceOffers}
                        </pre>
                    </details>
                ) : null}

                {debugMode && station.econtrol ? (
                    <details className="group rounded-2xl border border-gray-200 bg-white px-3 py-2">
                        <summary className="flex list-none items-center gap-2 text-xs font-semibold text-gray-700">
                            <span
                                aria-hidden="true"
                                className="text-gray-500 transition-transform group-open:rotate-90"
                            >
                                ▶
                            </span>
                            <span className="flex-auto">{t.station.rawData}</span>
                        </summary>
                        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-2 text-[11px] leading-snug text-gray-700">
                            {JSON.stringify(station.econtrol, null, 2)}
                        </pre>
                    </details>
                ) : null}
            </div>

            <div className="mt-3 grid gap-2">
                <button
                    type="button"
                    onClick={() =>
                        onSelectStationAsStart({
                            point: {
                                lat: station.lat,
                                lon: station.lon,
                                label: station.name,
                            },
                            price: selectedPrice,
                            station,
                        })
                    }
                    className="w-full rounded-2xl bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
                >
                    {t.route.setAsStart}
                </button>

                <button
                    type="button"
                    onClick={() =>
                        onSelectStationAsDestination({
                            point: {
                                lat: station.lat,
                                lon: station.lon,
                                label: station.name,
                            },
                            price: selectedPrice,
                            station,
                        })
                    }
                    className="w-full rounded-2xl bg-black px-3 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
                >
                    {t.route.setAsDestination}
                </button>
            </div>
        </div>
    );
}

function StationsLayer({
                            stations,
                            fuelType,
                            measurementSystem,
                            currencySystem,
                            language,
                            debugMode,
                            logoCacheBust,
                            userLocation,
                            onSelectStationAsDestination,
                            onSelectStationAsStart,
                            t,
                        }: {
    stations: Station[];
    fuelType: FuelType;
    measurementSystem: MeasurementSystem;
    currencySystem: CurrencySystem;
    language: Language;
    debugMode: boolean;
    logoCacheBust: number;
    userLocation: UserLocation | null;
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
    t: TranslationSchema;
}) {
    const map = useMap();

    return (
        <>
            {stations.map((station) => {
                const distanceKm =
                    userLocation != null
                        ? haversineKm(userLocation, station)
                        : null;
                const selectedPrice =
                    fuelType === "diesel" ? station.diesel : station.super95;

                const hasPrice =
                    selectedPrice !== null && selectedPrice !== undefined;

                const stationUi: Station = { ...station, distanceKm };

                return (
                    <React.Fragment key={station.id}>
                        <Marker
                            position={[stationUi.lat, stationUi.lon]}
                            icon={getStationDivIcon(stationUi, hasPrice, logoCacheBust)}
                        >
                            <Popup maxWidth={420} className="station-popup">
                                <StationPopupContent
                                    station={stationUi}
                                    selectedPrice={selectedPrice}
                                    fuelType={fuelType}
                                    measurementSystem={measurementSystem}
                                    currencySystem={currencySystem}
                                    language={language}
                                    debugMode={debugMode}
                                    logoCacheBust={logoCacheBust}
                                    t={t}
                                    onSelectStationAsStart={(payload) => {
                                        onSelectStationAsStart(payload);
                                        map.closePopup();
                                    }}
                                    onSelectStationAsDestination={(payload) => {
                                        onSelectStationAsDestination(payload);
                                        map.closePopup();
                                    }}
                                />
                            </Popup>
                        </Marker>

                        {hasPrice ? (
                            <PriceBadge
                                station={station}
                                fuelType={fuelType}
                                measurementSystem={measurementSystem}
                            />
                        ) : null}
                    </React.Fragment>
                );
            })}
        </>
    );
}

function OpenFreeMapBaseLayer({
    styleUrl,
    fallbackCenter,
    fallbackZoom,
}: {
    styleUrl: string;
    fallbackCenter: [number, number];
    fallbackZoom: number;
}) {
    const map = useMap();

    useEffect(() => {
        let cancelled = false;
        let layer: L.Layer | null = null;
        let styleImageMissingCleanup: (() => void) | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let startedAt = 0;
        let lastWarnAt = 0;

        (async () => {
            try {
                await ensureOpenFreeMapDeps();
                if (cancelled) return;

                await whenLeafletReady(map);
                if (cancelled) return;

                const factory = (L as unknown as { maplibreGL?: LeafletMapLibreFactory }).maplibreGL;
                if (typeof factory !== "function") {
                    throw new Error("Leaflet MapLibre binding not available (L.maplibreGL)");
                }

                startedAt = Date.now();

                const attachIfReady = () => {
                    if (cancelled) return;
                    if (layer) return;

                    // Nudge Leaflet: if the container is mid-resize/hidden, it may report invalid center temporarily.
                    try {
                        map.invalidateSize();
                    } catch {
                        // ignore
                    }

                    // If Leaflet got into a bad state (NaN center), force-set a known good view once.
                    if (!isLeafletSizeAndCenterValid(map)) {
                        try {
                            map.setView(
                                fallbackCenter,
                                Number.isFinite(map.getZoom()) ? map.getZoom() : fallbackZoom,
                                { animate: false }
                            );
                        } catch {
                            try {
                                map.setView(fallbackCenter, fallbackZoom, { animate: false });
                            } catch {
                                // ignore
                            }
                        }
                    }

                    try {
                        // Don't pre-gate on Leaflet center/size: the binding itself may be the first thing that
                        // forces Leaflet to fully compute it (especially after resizes / hidden containers).
                        const tmpLayer = factory({ style: styleUrl }) as LeafletMapLibreLayerLike;
                        tmpLayer.addTo(map);
                        layer = tmpLayer;

                        const maplibreMap = (layer as LeafletMapLibreLayerLike).getMaplibreMap?.();
                        if (maplibreMap) {
                            // Some styles reference icons that may not exist in the sprite (or sprite fetch might be blocked).
                            // Add a 1x1 transparent fallback so the map renders without noisy console warnings.
                            const transparent = new Uint8Array([0, 0, 0, 0]);
                            const onMissing = (ev: MapLibreStyleImageMissingEvent) => {
                                if (!ev?.id) return;
                                if (maplibreMap.hasImage(ev.id)) return;
                                try {
                                    maplibreMap.addImage(ev.id, {
                                        width: 1,
                                        height: 1,
                                        data: transparent,
                                    });
                                } catch {
                                    // ignore
                                }
                            };

                            maplibreMap.on("styleimagemissing", onMissing);
                            styleImageMissingCleanup = () =>
                                maplibreMap.off("styleimagemissing", onMissing);
                        }

                        map.attributionControl?.setPrefix(false);
                    } catch (e) {
                        const now = Date.now();
                        if (now - lastWarnAt > 2000) {
                            lastWarnAt = now;
                            const size = (() => {
                                try {
                                    const s = map.getSize();
                                    return `${s.x}x${s.y}`;
                                } catch {
                                    return "unknown";
                                }
                            })();
                            const rect = (() => {
                                try {
                                    const r = map.getContainer().getBoundingClientRect();
                                    return `${Math.round(r.width)}x${Math.round(r.height)}`;
                                } catch {
                                    return "unknown";
                                }
                            })();
                            const centerOk = isLeafletSizeAndCenterValid(map);
                            console.warn(
                                `OpenFreeMap layer attach failed (size=${size}, rect=${rect}, centerOk=${centerOk})`,
                                e
                            );
                        }
                        // Keep retrying for a while; don't hard-fail, because the map may become visible later.
                        const elapsed = Date.now() - startedAt;
                        if (elapsed > 15000) {
                            console.warn(
                                "OpenFreeMap layer not attached (Leaflet never became attachable after 15s)"
                            );
                            return;
                        }

                        // If a partial layer was added before throwing, try to remove it.
                        try {
                            if (layer) map.removeLayer(layer);
                        } catch {
                            // ignore
                        }
                        layer = null;
                        timer = setTimeout(attachIfReady, 250);
                    }
                };

                attachIfReady();
            } catch (e) {
                console.warn("OpenFreeMap layer failed to load", e);
            }
        })();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            styleImageMissingCleanup?.();
            if (layer) {
                try {
                    map.removeLayer(layer);
                } catch {
                    // ignore
                }
            }
        };
    }, [map, styleUrl, fallbackCenter, fallbackZoom]);

    return null;
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

    useEffect(() => {
        function handleLogoCacheCleared() {
            stationIconCache.clear();
            setLogoCacheBust((v) => v + 1);
        }

        window.addEventListener("tankify:logo-cache-cleared", handleLogoCacheCleared);
        return () =>
            window.removeEventListener("tankify:logo-cache-cleared", handleLogoCacheCleared);
    }, []);

    return (
        <div className="relative h-full w-full">
            <MapContainer
                center={safeCenter}
                zoom={FALLBACK_VIEW.zoom}
                scrollWheelZoom
                className="h-full w-full"
            >
                <OpenFreeMapBaseLayer
                    styleUrl={OPENFREE_MAP_STYLE_URL}
                    fallbackCenter={safeCenter}
                    fallbackZoom={FALLBACK_VIEW.zoom}
                />

                <ResizeFix />
                <RecenterControl
                    start={start}
                    end={end}
                    routeGeometry={routeGeometry}
                    t={t}
                    onUserLocationChange={setUserLocation}
                />
                <SearchHereControl onStationsLoaded={setStations} debugMode={debugMode} t={t} />
                <FitBounds start={start} end={end} routeGeometry={routeGeometry} />
                <ClickHandler pickMode={pickMode} onMapPick={onMapPick} />

                {routeGeometry.length > 0 ? (
                    <Polyline positions={routeGeometry} pathOptions={{ color: "#2563eb", weight: 5 }} />
                ) : null}

                <StationsLayer
                    stations={stations}
                    fuelType={fuelType}
                    measurementSystem={measurementSystem}
                    currencySystem={currencySystem}
                    language={language}
                    debugMode={debugMode}
                    logoCacheBust={logoCacheBust}
                    userLocation={userLocation}
                    onSelectStationAsDestination={onSelectStationAsDestination}
                    onSelectStationAsStart={onSelectStationAsStart}
                    t={t}
                />

                {!hideStartMarker ? (
                    <Marker position={[start.lat, start.lon]} icon={startPointIcon}>
                        <Popup>
                            {t.route.startPopup}: {start.label}
                        </Popup>
                    </Marker>
                ) : null}

                {!hideEndMarker ? (
                    <Marker position={[end.lat, end.lon]} icon={endPointIcon}>
                        <Popup>
                            {t.route.destinationPopup}: {end.label}
                        </Popup>
                    </Marker>
                ) : null}
            </MapContainer>
        </div>
    );
}

function RecenterControl({
                             start,
                             end,
                             routeGeometry,
                             t,
                             onUserLocationChange,
                         }: {
    start: Point;
    end: Point;
    routeGeometry: [number, number][];
    t: TranslationSchema;
    onUserLocationChange?: (loc: UserLocation | null) => void;
}) {
    const map = useMap();
    const [locationEnabled, setLocationEnabled] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [locationAttempt, setLocationAttempt] = useState(0);
    const didCenterOnEnableRef = useRef(false);
    const watchIdRef = useRef<number | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const canUseGeolocation =
        typeof navigator !== "undefined" && !!navigator.geolocation;

    useEffect(() => {
        const paneName = "user-location-pane";
        if (map.getPane(paneName)) return;
        const pane = map.createPane(paneName);
        // Above tiles/overlays, but below popups (Leaflet popupPane is 700).
        pane.style.zIndex = "650";
        pane.style.pointerEvents = "none";
    }, [map]);

    function handleRecenter() {
        const validRoute = routeGeometry.filter(
            (p) => isFiniteNumber(p[0]) && isFiniteNumber(p[1])
        );
        const points =
            validRoute.length > 0
                ? validRoute
                : [
                    sanitizeLatLng([start.lat, start.lon]),
                    sanitizeLatLng([end.lat, end.lon]),
                ];

        map.fitBounds(points as [number, number][], { padding: [30, 30] });

        setTimeout(() => {
            map.invalidateSize();
        }, 50);
    }

    function handleToggleLocation() {
        if (!canUseGeolocation) return;
        if (locationEnabled) {
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
            if (watchIdRef.current != null) {
                try {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                } catch {
                    // ignore
                }
            }
            watchIdRef.current = null;
            setUserLocation(null);
            onUserLocationChange?.(null);
            setLocationError(null);
            setLocationEnabled(false);
            return;
        }

        setLocationError(null);
        didCenterOnEnableRef.current = false;
        setLocationEnabled(true);
    }

    useEffect(() => {
        if (!locationEnabled) return;
        if (!canUseGeolocation) return;

        const commonOptions: PositionOptions = {
            enableHighAccuracy: true,
            maximumAge: 10_000,
            timeout: 12_000,
        };

        // Get an initial fix ASAP so the user sees a marker even if watchPosition takes longer.
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
                setUserLocation({ lat, lon });
                onUserLocationChange?.({ lat, lon });
                setLocationError(null);
                try {
                    window.localStorage.setItem(
                        "tankify-last-location",
                        JSON.stringify({ lat, lon, ts: Date.now() })
                    );
                } catch {}

                if (!didCenterOnEnableRef.current) {
                    didCenterOnEnableRef.current = true;
                    try {
                        map.setView([lat, lon], Math.max(map.getZoom(), 14), { animate: true });
                    } catch {
                        // ignore
                    }
                }
            },
            () => {
                // ignore; watchPosition will still handle errors
            },
            commonOptions
        );

        const id = navigator.geolocation.watchPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

                setUserLocation({ lat, lon });
                onUserLocationChange?.({ lat, lon });
                setLocationError(null);
                try {
                    window.localStorage.setItem(
                        "tankify-last-location",
                        JSON.stringify({ lat, lon, ts: Date.now() })
                    );
                } catch {}

                if (!didCenterOnEnableRef.current) {
                    didCenterOnEnableRef.current = true;
                    try {
                        map.flyTo([lat, lon], Math.max(map.getZoom(), 14), { animate: true });
                    } catch {
                        // ignore
                    }
                }
            },
            (err) => {
                setLocationError(err.message || "Location error");

                // Retry on transient failures (e.g. "position unavailable"), but don't spam.
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                // Permission denied (1) will not recover without user action.
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
                } catch {
                    // ignore
                }
            }
            watchIdRef.current = null;
        };
    }, [locationEnabled, canUseGeolocation, map, onUserLocationChange, locationAttempt]);

    return (
        <>
            {locationEnabled && userLocation ? (
                <Marker
                    position={[userLocation.lat, userLocation.lon]}
                    icon={userLocationIcon}
                    interactive={false}
                    pane="user-location-pane"
                />
            ) : null}

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
                    onClick={handleToggleLocation}
                    disabled={!canUseGeolocation}
                    title={
                        !canUseGeolocation
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
                        (!canUseGeolocation ? " opacity-60" : "")
                    }
                >
                    {t.route.myLocation}
                </button>
            </div>
        </>
    );
}

function ResizeFix() {
    const map = useMap();

    useEffect(() => {
        const container = map.getContainer();

        const runInvalidate = () => {
            requestAnimationFrame(() => {
                map.invalidateSize();
            });
        };

        const observer = new ResizeObserver(() => {
            runInvalidate();
        });

        observer.observe(container);

        const t1 = setTimeout(runInvalidate, 0);
        const t2 = setTimeout(runInvalidate, 150);
        const t3 = setTimeout(runInvalidate, 400);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            observer.disconnect();
        };
    }, [map]);

    return null;
}
