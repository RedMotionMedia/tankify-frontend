import { NextRequest, NextResponse } from "next/server";
import type { EControlGasStation } from "@/types/econtrol";
import { extractPriceAmount, fetchStationsForBounds } from "@/lib/econtrol/sprit";
import type { Station } from "@/types/tankify";
import { resolveStationBrandAndLogo } from "@/lib/branding/stationLogo";

type CacheEntry = { data: Station[]; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 15;
const MAX_CACHE_SIZE = 200;

function roundCoord(value: number, digits = 2): number {
    return Number(value.toFixed(digits));
}

function buildCacheKey(args: {
    south: number;
    west: number;
    north: number;
    east: number;
    centerLat: number;
    centerLon: number;
    includeClosed: boolean;
}): string {
    return [
        roundCoord(args.south),
        roundCoord(args.west),
        roundCoord(args.north),
        roundCoord(args.east),
        roundCoord(args.centerLat, 3),
        roundCoord(args.centerLon, 3),
        args.includeClosed ? "closed=1" : "closed=0",
    ].join(":");
}

function cleanupCache() {
    const now = Date.now();

    for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt <= now) cache.delete(key);
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

function parseBoolean(value: string | null): boolean | null {
    if (value === null) return null;
    if (value === "1" || value === "true") return true;
    if (value === "0" || value === "false") return false;
    return null;
}

function isValidBounds(south: number, west: number, north: number, east: number): boolean {
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

function toStationDto(station: EControlGasStation): Station | null {
    const lat = station.location?.latitude;
    const lon = station.location?.longitude;
    if (typeof lat !== "number" || typeof lon !== "number") return null;

    const diesel = extractPriceAmount(station, "DIE");
    const super95 = extractPriceAmount(station, "SUP");

    const id = station.id != null ? `econtrol-${station.id}` : `econtrol-${lat}-${lon}`;
    const logo = resolveStationBrandAndLogo({
        stationName: station.name ?? null,
        website:
            typeof station.contact?.website === "string" ? station.contact.website : null,
        email: typeof station.contact?.mail === "string" ? station.contact.mail : null,
    });

    return {
        id,
        lat,
        lon,
        name: station.name ?? "Fuel Station",
        address: station.location?.address,
        postalCode: station.location?.postalCode,
        city: station.location?.city,
        diesel,
        super95,
        open: station.open ?? null,
        distanceKm: typeof station.distance === "number" ? station.distance : null,
        source: "econtrol",
        brandName: logo.brandName,
        logoUrl: logo.logoUrl,
        econtrol: station, // pass-through: frontend can display everything (raw)
    };
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
        const includeClosedRaw = parseBoolean(searchParams.get("includeClosed"));
        const includeClosed = includeClosedRaw ?? false;

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

        const cacheKey = buildCacheKey({
            south,
            west,
            north,
            east,
            centerLat,
            centerLon,
            includeClosed,
        });

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

        const econtrolStations = await fetchStationsForBounds({
            bounds: { south, west, north, east },
            center: { lat: centerLat, lon: centerLon },
            includeClosed,
        });

        const stations = econtrolStations
            .map(toStationDto)
            .filter((s): s is Station => s !== null);

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
                includeClosed,
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
