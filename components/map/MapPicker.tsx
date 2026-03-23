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
import { FuelType, MapPickMode, Point, Station } from "@/types/tankify";
import { reverseGeocode } from "@/lib/geocode";
import { formatPrice } from "@/lib/format";
import { fetchStationsForVisibleMap } from "@/lib/route";

type Props = {
    start: Point;
    end: Point;
    routeGeometry: [number, number][];
    pickMode: MapPickMode;
    fuelType: FuelType;
    t: TranslationSchema;
    onMapPick: (type: "start" | "end", point: Point) => void;
    onSelectStationAsDestination: (payload: {
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
    const [hint, setHint] = useState(t.route.tapSearchHere);

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
                    className="pointer-events-auto rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700"
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
                    }: {
    station: Station;
    fuelType: FuelType;
}) {
    const value = fuelType === "diesel" ? station.diesel : station.super95;
    if (value === null || value === undefined) return null;

    return (
        <Marker
            position={[station.lat, station.lon]}
            interactive={false}
            icon={L.divIcon({
                className: "price-badge-marker",
                html: `<div class="price-badge-inner">${value.toFixed(3)}</div>`,
                iconSize: [56, 24],
                iconAnchor: [28, 38],
            })}
        />
    );
}

function StationsLayer({
                           stations,
                           fuelType,
                           onSelectStationAsDestination,
                           t,
                       }: {
    stations: Station[];
    fuelType: FuelType;
    onSelectStationAsDestination: (payload: {
        point: Point;
        price?: number | null;
        station: Station;
    }) => void;
    t: TranslationSchema;
}) {
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

                                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                        <div className="rounded-lg bg-gray-50 p-2">
                                            <div className="text-gray-500">{t.pricing.diesel}</div>
                                            <div className="font-semibold">
                                                {formatPrice(station.diesel)}
                                            </div>
                                        </div>

                                        <div className="rounded-lg bg-gray-50 p-2">
                                            <div className="text-gray-500">Super 95</div>
                                            <div className="font-semibold">
                                                {formatPrice(station.super95)}
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
                      {station.source === "econtrol-match"
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
                      {formatPrice(selectedPrice)}
                    </span>
                                    </div>

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
                                        className="mt-3 w-full rounded-xl bg-black px-3 py-2 text-sm font-medium text-white"
                                    >
                                        {t.route.setAsDestination}
                                    </button>
                                </div>
                            </Popup>
                        </CircleMarker>

                        {hasPrice ? <PriceBadge station={station} fuelType={fuelType} /> : null}
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
                                      t,
                                      onMapPick,
                                      onSelectStationAsDestination,
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
                    onSelectStationAsDestination={onSelectStationAsDestination}
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
                className="pointer-events-auto rounded-full bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-lg"
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