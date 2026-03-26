import { GeocodeResult, Point } from "../types/tankify";

export async function geocode(query: string): Promise<Point | null> {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(
        query
    )}`;

    const res = await fetch(url, {
        headers: { Accept: "application/json" },
    });

    if (!res.ok) {
        throw new Error("GEOCODE_FAILED");
    }

    const data: GeocodeResult[] = await res.json();
    if (!data.length) return null;

    return {
        lat: Number(data[0].lat),
        lon: Number(data[0].lon),
        label: data[0].display_name,
    };
}

export async function reverseGeocode(lat: number, lon: number) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
