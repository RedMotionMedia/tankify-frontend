"use client";

import L, { type LeafletMouseEvent } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
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

type Point = {
    lat: number;
    lon: number;
    label: string;
};

type FuelType = "diesel" | "super95";

type Station = {
    id: string;
    lat: number;
    lon: number;
    name: string;
    address?: string;
    city?: string;
    diesel?: number | null;
    super95?: number | null;
    open?: boolean | null;
    source?: "overpass" | "econtrol-match";
};

type Props = {
    start: Point;
    end: Point;
    routeGeometry: [number, number][];
    pickMode: "start" | "end" | null;
    fuelType: FuelType;
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

async function reverseGeocode(lat: number, lon: number) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;

    const res = await fetch(url, {
        headers: {
            Accept: "application/json",
        },
    });

    if (!res.ok) {
        return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }

    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function formatPrice(value?: number | null) {
    if (value === null || value === undefined) return "—";
    return `${value.toFixed(3)} €`;
}

async function fetchStationsForVisibleMap(bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
    centerLat: number;
    centerLon: number;
}): Promise<{ stations: Station[]; error?: string | null }> {
    const params = new URLSearchParams({
        south: String(bounds.south),
        west: String(bounds.west),
        north: String(bounds.north),
        east: String(bounds.east),
        centerLat: String(bounds.centerLat),
        centerLon: String(bounds.centerLon),
    });

    const res = await fetch(`/api/stations?${params.toString()}`);

    if (!res.ok) {
        let message = "Tankstellen konnten nicht geladen werden.";
        try {
            const data = await res.json();
            if (data?.error) message = data.error;
        } catch {
            // ignore
        }
        return { stations: [], error: message };
    }

    const data = await res.json();
    return { stations: data.stations ?? [], error: null };
}

function ClickHandler({
                          pickMode,
                          onMapPick,
                      }: {
    pickMode: "start" | "end" | null;
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
                           }: {
    onStationsLoaded: (stations: Station[]) => void;
}) {
    const map = useMap();
    const [loading, setLoading] = useState(false);
    const [hint, setHint] = useState("Tippe auf „Hier suchen“ für Tankstellen.");
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        function onMoveStart() {
            if (!mountedRef.current) return;
            setHint("Kartenausschnitt geändert – „Hier suchen“ drücken.");
        }

        map.on("movestart", onMoveStart);
        map.on("zoomstart", onMoveStart);

        return () => {
            mountedRef.current = false;
            map.off("movestart", onMoveStart);
            map.off("zoomstart", onMoveStart);
        };
    }, [map]);

    async function handleSearchHere() {
        const currentZoom = map.getZoom();

        if (currentZoom < 13) {
            setHint("Bitte näher hineinzoomen (mindestens Zoom 13).");
            onStationsLoaded([]);
            return;
        }

        setLoading(true);
        setHint("Tankstellen werden geladen ...");

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

            onStationsLoaded(result.stations);

            if (result.error) {
                setHint(result.error);
            } else {
                setHint(
                    result.stations.length > 0
                        ? `${result.stations.length} Tankstellen geladen.`
                        : "Keine Tankstellen gefunden."
                );
            }
        } catch (error) {
            console.error(error);
            onStationsLoaded([]);
            setHint("Tankstellen konnten nicht geladen werden.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="pointer-events-none absolute left-1/2 top-3 z-1000 -translate-x-1/2">
            <div className="flex flex-col items-center gap-2">
                <button
                    type="button"
                    onClick={handleSearchHere}
                    className="pointer-events-auto rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700"
                >
                    {loading ? "Lädt ..." : "Hier suchen"}
                </button>

                <div className="rounded-full bg-white/95 px-3 py-1 text-xs text-gray-700 shadow">
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
        <div className="rounded-full bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white shadow">
            {value.toFixed(3)}
        </div>
    );
}

function StationsLayer({
                           stations,
                           fuelType,
                           onSelectStationAsDestination,
                       }: {
    stations: Station[];
    fuelType: FuelType;
    onSelectStationAsDestination: (payload: {
        point: Point;
        price?: number | null;
        station: Station;
    }) => void;
}) {
    return (
        <>
            {stations.map((station) => {
                const selectedPrice =
                    fuelType === "diesel" ? station.diesel : station.super95;

                const hasPrice =
                    selectedPrice !== null && selectedPrice !== undefined;

                return (
                    <CircleMarker
                        key={station.id}
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
                            <div className="min-w-60">
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
                                        <div className="text-gray-500">Diesel</div>
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
                        ? "Geöffnet"
                        : station.open === false
                            ? "Geschlossen"
                            : "Öffnungsstatus unbekannt"}
                  </span>

                                    <span className="text-gray-400">
                    {station.source === "econtrol-match"
                        ? "Preis: E-Control"
                        : "Preis: —"}
                  </span>
                                </div>

                                <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                                    Ausgewählter Kraftstoff:{" "}
                                    <span className="font-semibold">
                    {fuelType === "diesel" ? "Diesel" : "Benzin"}
                  </span>
                                    {" · "}
                                    Preis:{" "}
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
                                    Als Ziel wählen
                                </button>
                            </div>
                        </Popup>

                        {hasPrice ? (
                            <Marker
                                position={[station.lat, station.lon]}
                                icon={L.divIcon({
                                    className: "price-badge-marker",
                                    html: `<div class="price-badge-inner">${selectedPrice!.toFixed(
                                        3
                                    )}</div>`,
                                    iconSize: [52, 22],
                                    iconAnchor: [26, 36],
                                })}
                            />
                        ) : null}
                    </CircleMarker>
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
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <SearchHereControl onStationsLoaded={setStations} />
                <FitBounds start={start} end={end} routeGeometry={routeGeometry} />
                <ClickHandler pickMode={pickMode} onMapPick={onMapPick} />

                {routeGeometry.length > 0 ? (
                    <Polyline
                        positions={routeGeometry}
                        pathOptions={{ color: "#2563eb", weight: 5 }}
                    />
                ) : null}

                <StationsLayer
                    stations={stations}
                    fuelType={fuelType}
                    onSelectStationAsDestination={onSelectStationAsDestination}
                />

                <Marker position={[start.lat, start.lon]} icon={markerIcon}>
                    <Popup>Start: {start.label}</Popup>
                </Marker>

                <Marker position={[end.lat, end.lon]} icon={markerIcon}>
                    <Popup>Ziel: {end.label}</Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}