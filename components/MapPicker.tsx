"use client";

import L from "leaflet";
import { useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";

type Point = {
    lat: number;
    lon: number;
    label: string;
};

type Props = {
    start: Point;
    end: Point;
    onSelectStart: (point: Point) => void;
    onSelectEnd: (point: Point) => void;
};

const startIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

const endIcon = new L.Icon({
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
                          onSelectStart,
                          onSelectEnd,
                      }: {
    onSelectStart: (point: Point) => void;
    onSelectEnd: (point: Point) => void;
}) {
    const [nextTarget, setNextTarget] = useState<"start" | "end">("start");

    useMapEvents({
        async click(e) {
            const lat = e.latlng.lat;
            const lon = e.latlng.lng;
            const label = await reverseGeocode(lat, lon);

            const point = { lat, lon, label };

            if (nextTarget === "start") {
                onSelectStart(point);
                setNextTarget("end");
            } else {
                onSelectEnd(point);
                setNextTarget("start");
            }
        },
    });

    return null;
}

export default function MapPicker({
                                      start,
                                      end,
                                      onSelectStart,
                                      onSelectEnd,
                                  }: Props) {
    const center: [number, number] = useMemo(() => {
        return [(start.lat + end.lat) / 2, (start.lon + end.lon) / 2];
    }, [start, end]);

    return (
        <MapContainer center={center} zoom={9} scrollWheelZoom className="h-full w-full">
            <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <ClickHandler onSelectStart={onSelectStart} onSelectEnd={onSelectEnd} />

            <Marker position={[start.lat, start.lon]} icon={startIcon}>
                <Popup>Start: {start.label}</Popup>
            </Marker>

            <Marker position={[end.lat, end.lon]} icon={endIcon}>
                <Popup>Ziel: {end.label}</Popup>
            </Marker>
        </MapContainer>
    );
}