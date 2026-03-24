"use client";

import L, { type LeafletMouseEvent } from "leaflet";
import React, { useEffect, useMemo, useState } from "react";
import {
    CircleMarker,
    MapContainer,
    Marker,
    Polyline,
    Popup,
    TileLayer,
    useMap,
    useMapEvents,
} from "react-leaflet";
import { TranslationSchema } from "@/config/i18n";
import {
    CurrencySystem,
    FuelType,
    MapPickMode,
    MeasurementSystem,
    Point,
    Station,
} from "@/types/tankify";
import { reverseGeocode } from "@/lib/geocode";
import { fetchStationsForVisibleMap } from "@/lib/route";
import { pricePerLiterToPerGallon } from "@/lib/units";

type Props = {
    start: Point;
    end: Point;
    routeGeometry: [number, number][];
    pickMode: MapPickMode;
    fuelType: FuelType;
    measurementSystem: MeasurementSystem;
    currencySystem: CurrencySystem;
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

const markerIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

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
        const points =
            routeGeometry.length > 0
                ? routeGeometry
                : [
                    [start.lat, start.lon],
                    [end.lat, end.lon],
                ];

        map.fitBounds(points as [number, number][], { padding: [30, 30] });
    }, [map, start, end, routeGeometry]);

    return null;
}

function SearchHereControl({
                               onStationsLoaded,
                               t,
                           }: {
    onStationsLoaded: (stations: Station[]) => void;
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
            });

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
                iconAnchor: [28, 38],
            })}
        />
    );
}

function StationsLayer({
                           stations,
                           fuelType,
                           measurementSystem,
                           currencySystem,
                           onSelectStationAsDestination,
                           onSelectStationAsStart,
                           t,
                       }: {
    stations: Station[];
    fuelType: FuelType;
    measurementSystem: MeasurementSystem;
    currencySystem: CurrencySystem;
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
                const selectedPrice =
                    fuelType === "diesel" ? station.diesel : station.super95;

                const hasPrice =
                    selectedPrice !== null && selectedPrice !== undefined;

                return (
                    <React.Fragment key={station.id}>
                        <CircleMarker
                            center={[station.lat, station.lon]}
                            radius={8}
                            pathOptions={{
                                color: hasPrice ? "#2563eb" : "#dc2626",
                                fillColor: hasPrice ? "#60a5fa" : "#ef4444",
                                fillOpacity: 0.9,
                                weight: 2,
                            }}
                        >
                            <Popup>
                                <div className="min-w-60 select-text">
                                    <div className="text-base font-semibold">{station.name}</div>

                                    {station.address ? (
                                        <div className="mt-1 text-sm text-gray-700">
                                            {station.address}
                                        </div>
                                    ) : null}

                                    {station.city ? (
                                        <div className="text-sm text-gray-500">{station.city}</div>
                                    ) : null}

                                    {station.postalCode ? (
                                        <div className="text-sm text-gray-500">
                                            {t.station.postalCode}: {station.postalCode}
                                        </div>
                                    ) : null}

                                    {station.distanceKm != null ? (
                                        <div className="text-sm text-gray-500">
                                            {t.station.distance}: {station.distanceKm.toFixed(2)} km
                                        </div>
                                    ) : null}

                                    {station.econtrol?.contact ? (
                                        <div className="mt-2 space-y-1 text-xs text-gray-600">
                                            <div className="font-medium text-gray-500">
                                                {t.station.contact}
                                            </div>

                                            {station.econtrol.contact.telephone ? (
                                                <div>
                                                    <span className="font-medium">
                                                        {t.station.phone}:
                                                    </span>{" "}
                                                    {station.econtrol.contact.telephone}
                                                </div>
                                            ) : null}

                                            {station.econtrol.contact.fax ? (
                                                <div>
                                                    <span className="font-medium">
                                                        {t.station.fax}:
                                                    </span>{" "}
                                                    {station.econtrol.contact.fax}
                                                </div>
                                            ) : null}

                                            {station.econtrol.contact.mail ? (
                                                <div>
                                                    <span className="font-medium">
                                                        {t.station.mail}:
                                                    </span>{" "}
                                                    <a
                                                        href={`mailto:${station.econtrol.contact.mail}`}
                                                        className="underline"
                                                    >
                                                        {station.econtrol.contact.mail}
                                                    </a>
                                                </div>
                                            ) : null}

                                            {station.econtrol.contact.website ? (
                                                <div>
                                                    <span className="font-medium">
                                                        {t.station.website}:
                                                    </span>{" "}
                                                    <a
                                                        href={
                                                            station.econtrol.contact.website.startsWith("http")
                                                                ? station.econtrol.contact.website
                                                                : `https://${station.econtrol.contact.website}`
                                                        }
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="underline"
                                                    >
                                                        {station.econtrol.contact.website}
                                                    </a>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {station.econtrol?.offerInformation ? (
                                        <div className="mt-2 text-xs text-gray-600">
                                            <div className="font-medium text-gray-500">
                                                {t.station.services}
                                            </div>
                                            <div>
                                                service:{" "}
                                                {String(!!station.econtrol.offerInformation.service)}
                                                {" · "}selfService:{" "}
                                                {String(!!station.econtrol.offerInformation.selfService)}
                                                {" · "}unattended:{" "}
                                                {String(!!station.econtrol.offerInformation.unattended)}
                                            </div>
                                        </div>
                                    ) : null}

                                    {station.econtrol?.paymentMethods ? (
                                        <div className="mt-2 text-xs text-gray-600">
                                            <div className="font-medium text-gray-500">
                                                {t.station.payment}
                                            </div>
                                            <div>
                                                cash:{" "}
                                                {String(!!station.econtrol.paymentMethods.cash)}
                                                {" · "}debitCard:{" "}
                                                {String(!!station.econtrol.paymentMethods.debitCard)}
                                                {" · "}creditCard:{" "}
                                                {String(!!station.econtrol.paymentMethods.creditCard)}
                                            </div>
                                            {station.econtrol.paymentMethods.others ? (
                                                <div className="whitespace-pre-wrap text-gray-500">
                                                    {station.econtrol.paymentMethods.others}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {station.econtrol?.otherServiceOffers ? (
                                        <details className="mt-2">
                                            <summary className="cursor-pointer text-xs font-medium text-gray-600">
                                                {t.station.otherOffers}
                                            </summary>
                                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-[11px] leading-snug text-gray-700">
                                                {station.econtrol.otherServiceOffers}
                                            </pre>
                                        </details>
                                    ) : null}

                                    {Array.isArray(station.econtrol?.openingHours) &&
                                    station.econtrol.openingHours.length > 0 ? (
                                        <details className="mt-2">
                                            <summary className="cursor-pointer text-xs font-medium text-gray-600">
                                                {t.station.openingHours}
                                            </summary>
                                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-[11px] leading-snug text-gray-700">
                                                {JSON.stringify(
                                                    station.econtrol.openingHours,
                                                    null,
                                                    2
                                                )}
                                            </pre>
                                        </details>
                                    ) : null}

                                    {station.econtrol ? (
                                        <details className="mt-2">
                                            <summary className="cursor-pointer text-xs font-medium text-gray-600">
                                                {t.station.rawData}
                                            </summary>
                                            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-[11px] leading-snug text-gray-700">
                                                {JSON.stringify(station.econtrol, null, 2)}
                                            </pre>
                                        </details>
                                    ) : null}

                                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                        <div className="rounded-lg bg-gray-50 p-2">
                                            <div className="text-gray-500">{t.pricing.diesel}</div>
                                            <div className="font-semibold">
                                                {formatDisplayPrice(
                                                    station.diesel,
                                                    measurementSystem,
                                                    currencySystem
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-lg bg-gray-50 p-2">
                                            <div className="text-gray-500">Super 95</div>
                                            <div className="font-semibold">
                                                {formatDisplayPrice(
                                                    station.super95,
                                                    measurementSystem,
                                                    currencySystem
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between text-xs">
                    <span
                        className={
                            station.open === true
                                ? "font-medium text-green-600"
                                : station.open === false
                                    ? "font-medium text-red-600"
                                    : "text-gray-500"
                        }
                    >
                      {station.open === true
                          ? t.station.open
                          : station.open === false
                              ? t.station.closed
                              : t.station.unknown}
                    </span>

                                        <span className="text-gray-400">
                      {station.source === "econtrol"
                          ? t.pricing.sourceEcontrol
                          : t.pricing.sourceUnknown}
                    </span>
                                    </div>

                                    <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                                        {t.pricing.selectedFuel}:{" "}
                                        <span className="font-semibold">
                      {fuelType === "diesel"
                          ? t.pricing.diesel
                          : t.pricing.super95}
                    </span>
                                        {" · "}
                                        {t.pricing.sourcePrice}:{" "}
                                        <span className="font-semibold">
                      {formatDisplayPrice(
                          selectedPrice,
                          measurementSystem,
                          currencySystem
                      )}
                    </span>
                                    </div>

                                    <div className="mt-3 grid gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onSelectStationAsStart({
                                                    point: {
                                                        lat: station.lat,
                                                        lon: station.lon,
                                                        label: station.name,
                                                    },
                                                    price: selectedPrice,
                                                    station,
                                                });

                                                map.closePopup();
                                            }}
                                            className="w-full rounded-xl bg-gray-800 px-3 py-2 text-sm font-medium text-white"
                                        >
                                            {t.route.setAsStart}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                onSelectStationAsDestination({
                                                    point: {
                                                        lat: station.lat,
                                                        lon: station.lon,
                                                        label: station.name,
                                                    },
                                                    price: selectedPrice,
                                                    station,
                                                });

                                                map.closePopup();
                                            }}
                                            className="w-full rounded-xl bg-black px-3 py-2 text-sm font-medium text-white"
                                        >
                                            {t.route.setAsDestination}
                                        </button>
                                    </div>
                                </div>
                            </Popup>
                        </CircleMarker>

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

export default function MapPicker({
                                      start,
                                      end,
                                      routeGeometry,
                                      pickMode,
                                      fuelType,
                                      measurementSystem,
                                      currencySystem,
                                      t,
                                      onMapPick,
                                      onSelectStationAsDestination,
                                      onSelectStationAsStart,
                                  }: Props) {
    const [stations, setStations] = useState<Station[]>([]);

    const center = useMemo<[number, number]>(() => {
        return [(start.lat + end.lat) / 2, (start.lon + end.lon) / 2];
    }, [start, end]);

    return (
        <div className="relative h-full w-full">
            <MapContainer center={center} zoom={9} scrollWheelZoom className="h-full w-full">
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <ResizeFix />
                <RecenterControl start={start} end={end} routeGeometry={routeGeometry} t={t} />
                <SearchHereControl onStationsLoaded={setStations} t={t} />
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
                    onSelectStationAsDestination={onSelectStationAsDestination}
                    onSelectStationAsStart={onSelectStationAsStart}
                    t={t}
                />

                <Marker position={[start.lat, start.lon]} icon={markerIcon}>
                    <Popup>
                        {t.route.startPopup}: {start.label}
                    </Popup>
                </Marker>

                <Marker position={[end.lat, end.lon]} icon={markerIcon}>
                    <Popup>
                        {t.route.destinationPopup}: {end.label}
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}

function RecenterControl({
                             start,
                             end,
                             routeGeometry,
                             t,
                         }: {
    start: Point;
    end: Point;
    routeGeometry: [number, number][];
    t: TranslationSchema;
}) {
    const map = useMap();

    function handleRecenter() {
        const points =
            routeGeometry.length > 0
                ? routeGeometry
                : [
                    [start.lat, start.lon],
                    [end.lat, end.lon],
                ];

        map.fitBounds(points as [number, number][], { padding: [30, 30] });

        setTimeout(() => {
            map.invalidateSize();
        }, 50);
    }

    return (
        <div className="pointer-events-none absolute right-3 top-3 z-1000">
            <button
                type="button"
                onClick={handleRecenter}
                className="pointer-events-auto rounded-full bg-white px-3 py-2 text-sm font-medium transition text-gray-900 shadow-lg active:scale-95"
            >
                {t.route.center}
            </button>
        </div>
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
