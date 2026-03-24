import { NextRequest, NextResponse } from "next/server";

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
    source?: "econtrol";
};

type CacheEntry = {
    data: Station[];
    expiresAt: number;
};

type Bounds = {
    south: number;
    west: number;
    north: number;
    east: number;
};

type EControlStation = {
    id: string;
    lat: number;
    lon: number;
    name: string;
    address?: string;
    city?: string;
    diesel?: number | null;
    super95?: number | null;
    open?: boolean | null;
};

type EControlPrice = {
    fuelType?: string;
    amount?: number | null;
};

type EControlApiItem = {
    id?: string | number;
    name?: string;
    open?: boolean | null;
    location?: {
        latitude?: number;
        longitude?: number;
        address?: string;
        city?: string;
    };
    prices?: EControlPrice[];
};

const cache = new Map<string, CacheEntry>();

const CACHE_TTL_MS = 1000 * 60 * 15;
const MAX_CACHE_SIZE = 200;
const ECONTROL_BASE_URL =
    "https://api.e-control.at/sprit/1.0/search/gas-stations/by-address";

function roundCoord(value: number, digits = 2): number {
    return Number(value.toFixed(digits));
}

function toRadians(value: number): number {
    return (value * Math.PI) / 180;
}

function approxKmInBounds(bounds: Bounds): { widthKm: number; heightKm: number } {
    const meanLat = (bounds.north + bounds.south) / 2;
    const kmPerDegLat = 111.32;
    const kmPerDegLon = 111.32 * Math.cos(toRadians(meanLat));

    return {
        widthKm: Math.abs(bounds.east - bounds.west) * kmPerDegLon,
        heightKm: Math.abs(bounds.north - bounds.south) * kmPerDegLat,
    };
}

function buildCacheKey(
    south: number,
    west: number,
    north: number,
    east: number,
    centerLat: number,
    centerLon: number
): string {
    return [
        roundCoord(south),
        roundCoord(west),
        roundCoord(north),
        roundCoord(east),
        roundCoord(centerLat, 3),
        roundCoord(centerLon, 3),
    ].join(":");
}

function cleanupCache() {
    const now = Date.now();

    for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt <= now) {
            cache.delete(key);
        }
    }

    if (cache.size <= MAX_CACHE_SIZE) return;

    const sorted = [...cache.entries()].sort(
        (a, b) => a[1].expiresAt - b[1].expiresAt
    );

    for (const [key] of sorted.slice(0, cache.size - MAX_CACHE_SIZE)) {
        cache.delete(key);
    }
}

function parseNumber(value: string | null): number | null {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function isValidBounds(
    south: number,
    west: number,
    north: number,
    east: number
): boolean {
    return (
        south >= -90 &&
        south <= 90 &&
        north >= -90 &&
        north <= 90 &&
        west >= -180 &&
        west <= 180 &&
        east >= -180 &&
        east <= 180 &&
        south < north &&
        west < east
    );
}

function normalizeEControlItem(item: EControlApiItem): EControlStation | null {
    const lat = item.location?.latitude;
    const lon = item.location?.longitude;

    if (typeof lat !== "number" || typeof lon !== "number") {
        return null;
    }

    const prices = Array.isArray(item.prices) ? item.prices : [];

    const diesel =
        prices.find((p) => p.fuelType === "DIE")?.amount ?? null;
    const super95 =
        prices.find((p) => p.fuelType === "SUP")?.amount ?? null;

    return {
        id: `econtrol-${item.id ?? `${lat}-${lon}`}`,
        lat,
        lon,
        name: item.name || "Fuel Station",
        address: item.location?.address,
        city: item.location?.city,
        diesel,
        super95,
        open: item.open ?? null,
    };
}

async function fetchEControlByFuel(
    fuelType: "DIE" | "SUP",
    latitude: number,
    longitude: number
): Promise<EControlStation[]> {
    const params = new URLSearchParams({
        fuelType,
        latitude: String(latitude),
        longitude: String(longitude),
        includeClosed: "false",
    });

    const url = `${ECONTROL_BASE_URL}?${params.toString()}`;
    const res = await fetch(url, {
        headers: {
            Accept: "application/json",
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.warn("E-Control request failed", res.status, text.slice(0, 200));
        return [];
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
        const text = await res.text();
        console.warn("E-Control returned non-JSON", text.slice(0, 200));
        return [];
    }

    const data = (await res.json()) as unknown;

    if (!Array.isArray(data)) return [];

    console.log(data);

    return data
        .map((item) => normalizeEControlItem(item as EControlApiItem))
        .filter((station): station is EControlStation => station !== null);
}

async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += limit) {
        const chunk = items.slice(i, i + limit);
        const chunkResults = await Promise.all(chunk.map(fn));
        results.push(...chunkResults);
    }

    return results;
}

async function fetchEControlEnriched(
    latitude: number,
    longitude: number
): Promise<EControlStation[]> {
    const [dieselStations, superStations] = await Promise.all([
        fetchEControlByFuel("DIE", latitude, longitude),
        fetchEControlByFuel("SUP", latitude, longitude),
    ]);

    const merged = new Map<string, EControlStation>();

    for (const station of [...dieselStations, ...superStations]) {
        const key = `${roundCoord(station.lat, 5)}:${roundCoord(station.lon, 5)}`;

        if (!merged.has(key)) {
            merged.set(key, { ...station });
            continue;
        }

        const current = merged.get(key)!;

        merged.set(key, {
            ...current,
            name: station.name || current.name,
            address: station.address || current.address,
            city: station.city || current.city,
            diesel:
                station.diesel !== null && station.diesel !== undefined
                    ? station.diesel
                    : current.diesel,
            super95:
                station.super95 !== null && station.super95 !== undefined
                    ? station.super95
                    : current.super95,
            open: station.open ?? current.open,
        });
    }

    return [...merged.values()];
}

function dedupeEControlStations(stations: EControlStation[]): EControlStation[] {
    const map = new Map<string, EControlStation>();

    for (const station of stations) {
        const key = `${roundCoord(station.lat, 5)}:${roundCoord(station.lon, 5)}`;

        if (!map.has(key)) {
            map.set(key, station);
            continue;
        }

        const current = map.get(key)!;

        map.set(key, {
            ...current,
            name: station.name || current.name,
            address: station.address || current.address,
            city: station.city || current.city,
            diesel:
                station.diesel !== null && station.diesel !== undefined
                    ? station.diesel
                    : current.diesel,
            super95:
                station.super95 !== null && station.super95 !== undefined
                    ? station.super95
                    : current.super95,
            open: station.open ?? current.open,
        });
    }

    return [...map.values()];
}

function toStationDto(station: EControlStation): Station {
    return {
        id: station.id,
        lat: station.lat,
        lon: station.lon,
        name: station.name,
        address: station.address,
        city: station.city,
        diesel: station.diesel ?? null,
        super95: station.super95 ?? null,
        open: station.open ?? null,
        source: "econtrol",
    };
}

function isInBounds(station: { lat: number; lon: number }, bounds: Bounds): boolean {
    return (
        station.lat >= bounds.south &&
        station.lat <= bounds.north &&
        station.lon >= bounds.west &&
        station.lon <= bounds.east
    );
}

function buildSamplePoints(
    bounds: Bounds,
    centerLat: number,
    centerLon: number
): Array<{ lat: number; lon: number }> {
    const midLat = (bounds.north + bounds.south) / 2;
    const midLon = (bounds.east + bounds.west) / 2;
    const { widthKm, heightKm } = approxKmInBounds(bounds);
    const maxKm = Math.max(widthKm, heightKm);

    const points: Array<{ lat: number; lon: number }> = [
        { lat: centerLat, lon: centerLon },
    ];

    if (maxKm > 2) {
        points.push(
            { lat: bounds.north, lon: midLon },
            { lat: bounds.south, lon: midLon },
            { lat: midLat, lon: bounds.east },
            { lat: midLat, lon: bounds.west }
        );
    }

    if (maxKm > 10) {
        points.push(
            { lat: bounds.north, lon: bounds.west },
            { lat: bounds.north, lon: bounds.east },
            { lat: bounds.south, lon: bounds.west },
            { lat: bounds.south, lon: bounds.east }
        );
    }

    const unique = new Map<string, { lat: number; lon: number }>();
    for (const p of points) {
        const key = `${roundCoord(p.lat, 4)}:${roundCoord(p.lon, 4)}`;
        unique.set(key, p);
    }

    return [...unique.values()];
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        const south = parseNumber(searchParams.get("south"));
        const west = parseNumber(searchParams.get("west"));
        const north = parseNumber(searchParams.get("north"));
        const east = parseNumber(searchParams.get("east"));
        const centerLat = parseNumber(searchParams.get("centerLat"));
        const centerLon = parseNumber(searchParams.get("centerLon"));

        if (
            south === null ||
            west === null ||
            north === null ||
            east === null ||
            centerLat === null ||
            centerLon === null ||
            !isValidBounds(south, west, north, east)
        ) {
            return NextResponse.json(
                { error: "Invalid map bounds or center." },
                { status: 400 }
            );
        }

        cleanupCache();

        const bounds: Bounds = { south, west, north, east };
        const cacheKey = buildCacheKey(
            south,
            west,
            north,
            east,
            centerLat,
            centerLon
        );

        const now = Date.now();
        const cached = cache.get(cacheKey);

        if (cached && cached.expiresAt > now) {
            return NextResponse.json(
                { stations: cached.data, cached: true },
                {
                    headers: {
                        "Cache-Control":
                            "public, max-age=300, stale-while-revalidate=900",
                    },
                }
            );
        }

        const samplePoints = buildSamplePoints(bounds, centerLat, centerLon);

        const perPoint = await mapWithConcurrency(
            samplePoints,
            3,
            async (p) => fetchEControlEnriched(p.lat, p.lon)
        );

        const deduped = dedupeEControlStations(perPoint.flat())
            .filter((s) => isInBounds(s, bounds))
            .sort((a, b) => {
                const aHasPrice = a.diesel != null || a.super95 != null;
                const bHasPrice = b.diesel != null || b.super95 != null;

                if (aHasPrice !== bHasPrice) return aHasPrice ? -1 : 1;
                return a.name.localeCompare(b.name, "de");
            });

        const stations = deduped.map(toStationDto);

        cache.set(cacheKey, {
            data: stations,
            expiresAt: now + CACHE_TTL_MS,
        });

        cleanupCache();

        return NextResponse.json(
            {
                stations,
                cached: false,
                pricingSource: "E-Control",
            },
            {
                headers: {
                    "Cache-Control":
                        "public, max-age=300, stale-while-revalidate=900",
                },
            }
        );
    } catch (error) {
        console.error("Stations API error:", error);

        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        );
    }
}
