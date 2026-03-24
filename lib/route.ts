import {Point, RouteData, Station} from "@/types/tankify";

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
}): Promise<{stations: Station[]; error?: string | null}> {
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
        } catch {}

        return { stations: [], error: message };
    }

    const data = await res.json();
    return {stations: (data.stations ?? []) as Station[], error: null};
}
