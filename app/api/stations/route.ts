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
    source?: "overpass" | "econtrol-match";
};

type CacheEntry = {
    data: Station[];
    expiresAt: number;
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

const cache = new Map<string, CacheEntry>();

const CACHE_TTL_MS = 1000 * 60 * 15;
const MAX_CACHE_SIZE = 200;
const ECONTROL_BASE_URL =
    "https://api.e-control.at/sprit/1.0/search/gas-stations/by-address";

function roundCoord(value: number, digits = 2): number {
    return Number(value.toFixed(digits));
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

function haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeName(value: string | undefined): string {
    return (value ?? "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

function normalizeOverpassStations(elements: any[]): (null | {
    id: string;
    lat: number;
    lon: number;
    name: any;
    address: string | undefined;
    city: any;
    diesel: null;
    super95: null;
    open: null;
    source: string
})[] {
    return elements
        .map((el) => {
            const lat = el.lat ?? el.center?.lat;
            const lon = el.lon ?? el.center?.lon;

            if (typeof lat !== "number" || typeof lon !== "number") return null;

            const tags = el.tags ?? {};
            const parts = [
                tags["addr:street"],
                tags["addr:housenumber"],
                tags["addr:postcode"],
                tags["addr:city"],
            ].filter(Boolean);

            return {
                id: `${el.type}-${el.id}`,
                lat,
                lon,
                name: tags.name || tags.brand || tags.operator || "Fuel Station",
                address: parts.join(", ") || undefined,
                city: tags["addr:city"] || undefined,
                diesel: null,
                super95: null,
                open: null,
                source: "overpass" as const,
            };
        })
        .filter((s): s is Station => s !== null);
}

async function fetchOverpassStations(bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
}): Promise<({
    id: string;
    lat: number;
    lon: number;
    name: any;
    address: string | undefined;
    city: any;
    diesel: null;
    super95: null;
    open: null;
    source: string
} | null)[]> {
    const query = `
[out:json][timeout:25];
(
  node["amenity"="fuel"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
  way["amenity"="fuel"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
  relation["amenity"="fuel"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
);
out center tags;
`.trim();

    const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=UTF-8",
        },
        body: query,
    });

    if (res.status === 429) {
        return [];
    }
    if (!res.ok) {
        console.error(`Overpass failed with status ${res.status}`);
        return [];
    }

    const data = await res.json();
    return normalizeOverpassStations(data.elements ?? []);
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

    const data = await res.json();

    return (Array.isArray(data) ? data : []).map((item: any) => {
        const prices = Array.isArray(item.prices) ? item.prices : [];

        const diesel =
            prices.find((p: any) => p.fuelType === "DIE")?.amount ?? null;
        const super95 =
            prices.find((p: any) => p.fuelType === "SUP")?.amount ?? null;

        return {
            id: `econtrol-${item.id}`,
            lat: item.location?.latitude,
            lon: item.location?.longitude,
            name: item.name || "Fuel Station",
            address: item.location?.address,
            city: item.location?.city,
            diesel,
            super95,
            open: item.open ?? null,
        };
    }).filter(
        (s: EControlStation) =>
            typeof s.lat === "number" && typeof s.lon === "number"
    );
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

function mergeStations(
    overpassStations: Station[],
    econtrolStations: EControlStation[]
): Station[] {
    return overpassStations.map((station) => {
        let bestMatch: EControlStation | null = null;
        let bestScore = Number.POSITIVE_INFINITY;

        for (const candidate of econtrolStations) {
            const distance = haversineMeters(
                station.lat,
                station.lon,
                candidate.lat,
                candidate.lon
            );

            const sameName =
                normalizeName(station.name) &&
                normalizeName(candidate.name) &&
                normalizeName(station.name) === normalizeName(candidate.name);

            const score = sameName ? distance * 0.5 : distance;

            if (score < bestScore) {
                bestScore = score;
                bestMatch = candidate;
            }
        }

        if (!bestMatch) return station;

        const realDistance = haversineMeters(
            station.lat,
            station.lon,
            bestMatch.lat,
            bestMatch.lon
        );

        if (realDistance > 120) {
            return station;
        }

        return {
            ...station,
            name: bestMatch.name || station.name,
            address: bestMatch.address || station.address,
            city: bestMatch.city || station.city,
            diesel:
                bestMatch.diesel !== null && bestMatch.diesel !== undefined
                    ? bestMatch.diesel
                    : station.diesel,
            super95:
                bestMatch.super95 !== null && bestMatch.super95 !== undefined
                    ? bestMatch.super95
                    : station.super95,
            open: bestMatch.open ?? station.open,
            source: "econtrol-match",
        };
    });
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

        const cacheKey = buildCacheKey(
            south,
            west,
            north,
            east,
            centerLat,
            centerLon
        );

        const cached = cache.get(cacheKey);
        const now = Date.now();

        if (cached && cached.expiresAt > now) {
            return NextResponse.json(
                { stations: cached.data, cached: true },
                {
                    headers: {
                        "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
                    },
                }
            );
        }

        const [overpassStations, econtrolStations] = await Promise.all([
            fetchOverpassStations({ south, west, north, east }),
            fetchEControlEnriched(centerLat, centerLon),
        ]);

        const merged = mergeStations(overpassStations, econtrolStations);

        cache.set(cacheKey, {
            data: merged,
            expiresAt: now + CACHE_TTL_MS,
        });

        cleanupCache();

        return NextResponse.json(
            {
                stations: merged,
                cached: false,
                pricingSource: "E-Control by-address matching",
            },
            {
                headers: {
                    "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
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