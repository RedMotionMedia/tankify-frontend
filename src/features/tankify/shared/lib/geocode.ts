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

export async function geocodeSuggestions(query: string, limit = 5): Promise<Point[]> {
    const q = query.trim();
    if (!q) return [];
    const safeLimit = Number.isFinite(limit) ? Math.min(10, Math.max(1, Math.floor(limit))) : 5;

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${safeLimit}&q=${encodeURIComponent(
        q
    )}`;

    const res = await fetch(url, {
        headers: { Accept: "application/json" },
    });

    if (!res.ok) {
        throw new Error("GEOCODE_FAILED");
    }

    const data: GeocodeResult[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    const out: Point[] = [];
    for (const row of data) {
        const lat = Number((row as { lat?: unknown }).lat);
        const lon = Number((row as { lon?: unknown }).lon);
        const label = String((row as { display_name?: unknown }).display_name ?? "").trim();
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !label) continue;
        out.push({ lat, lon, label });
    }
    return out;
}

export async function reverseGeocode(lat: number, lon: number) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
