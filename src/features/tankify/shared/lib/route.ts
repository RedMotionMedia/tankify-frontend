import { Point, RouteData, Station } from "../types/tankify";

export async function fetchRoute(
    start: Point,
    end: Point
): Promise<RouteData | null> {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.routes || !data.routes.length) return null;

    const route = data.routes[0];

    return {
        distanceKm: route.distance / 1000,
        durationHours: route.duration / 3600,
        geometry: route.geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]]
        ),
    };
}

export async function fetchStationsForVisibleMap(bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
    centerLat: number;
    centerLon: number;
}, options?: { includeClosed?: boolean; debug?: boolean }): Promise<{stations: Station[]; error?: { code: "LOAD_FAILED"; detail?: string } | null}> {
    const params = new URLSearchParams({
        south: String(bounds.south),
        west: String(bounds.west),
        north: String(bounds.north),
        east: String(bounds.east),
        centerLat: String(bounds.centerLat),
        centerLon: String(bounds.centerLon),
    });

    if (options?.includeClosed) params.set("includeClosed", "1");
    if (options?.debug) params.set("debug", "1");

    const res = await fetch(`/api/stations?${params.toString()}`);

    if (!res.ok) {
        let detail: string | undefined = undefined;

        try {
            const data = await res.json();
            if (typeof data?.error === "string" && data.error.trim()) detail = data.error.trim();
        } catch {}

        return { stations: [], error: { code: "LOAD_FAILED", detail } };
    }

    const data = await res.json();
    return {stations: (data.stations ?? []) as Station[], error: null};
}
