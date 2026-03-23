"use client";

import L, { type LeafletMouseEvent } from "leaflet";
import { useEffect, useMemo } from "react";
import {
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

type Props = {
    start: Point;
    end: Point;
    routeGeometry: [number, number][];
    pickMode: "start" | "end" | null;
    onMapPick: (type: "start" | "end", point: Point) => void;
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

export default function MapPicker({
                                      start,
                                      end,
                                      routeGeometry,
                                      pickMode,
                                      onMapPick,
                                  }: Props) {
    const center = useMemo<[number, number]>(() => {
        return [(start.lat + end.lat) / 2, (start.lon + end.lon) / 2];
    }, [start, end]);

    return (
        <MapContainer center={center} zoom={9} scrollWheelZoom className="h-full w-full">
            <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FitBounds start={start} end={end} routeGeometry={routeGeometry} />
            <ClickHandler pickMode={pickMode} onMapPick={onMapPick} />

            {routeGeometry.length > 0 ? (
                <Polyline positions={routeGeometry} pathOptions={{ color: "#2563eb", weight: 5 }} />
            ) : null}

            <Marker position={[start.lat, start.lon]} icon={markerIcon}>
                <Popup>Start: {start.label}</Popup>
            </Marker>

            <Marker position={[end.lat, end.lon]} icon={markerIcon}>
                <Popup>Ziel: {end.label}</Popup>
            </Marker>
        </MapContainer>
    );
}