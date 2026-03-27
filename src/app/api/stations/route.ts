import { NextRequest, NextResponse } from "next/server";
import type {
    EControlGasStation,
    EControlOpeningHour,
} from "@/features/tankify/shared/types/econtrol";
import { extractPriceAmount, fetchStationsForBounds } from "@/features/tankify/server/econtrol/sprit";
import type { Station } from "@/features/tankify/shared/types/tankify";
import { resolveStationBrandAndLogo } from "@/features/tankify/server/branding/stationLogo";

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

function asString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}

function asBool(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
}

function normalizeOpeningHours(value: unknown): Station["openingHours"] {
    if (!Array.isArray(value)) return undefined;

    const out = value
        .map((entry): NonNullable<Station["openingHours"]>[number] | null => {
            const e = entry as EControlOpeningHour;
            const day = asString(e?.day);
            if (!day) return null;

            const from = asString(e?.from);
            const to = asString(e?.to);
            const label = asString(e?.label);
            const order = typeof e?.order === "number" ? e.order : null;

            return { day, from, to, label, order };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

    return out.length ? out : undefined;
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

function toStationDto(station: EControlGasStation, includeEcontrol: boolean): Station | null {
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

    const dto: Station = {
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
        openingHours: normalizeOpeningHours(station.openingHours),
        contact: station.contact
            ? {
                telephone: asString(station.contact.telephone),
                fax: asString(station.contact.fax),
                mail: asString(station.contact.mail),
                website: asString(station.contact.website),
            }
            : undefined,
        paymentMethods: station.paymentMethods
            ? {
                cash: asBool(station.paymentMethods.cash),
                debitCard: asBool(station.paymentMethods.debitCard),
                creditCard: asBool(station.paymentMethods.creditCard),
                others: asString(station.paymentMethods.others),
            }
            : undefined,
        otherServiceOffers: asString(station.otherServiceOffers),
    };

    if (includeEcontrol) {
        dto.econtrol = station; // pass-through: frontend can display everything (raw)
    }

    return dto;
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

        const debugRaw = parseBoolean(searchParams.get("debug"));
        const debugRequested = debugRaw ?? false;
        const debugAllowed = process.env.NODE_ENV !== "production" || (process.env.ENABLE_DEBUG_MODE ?? "").trim() === "1";
        const includeEcontrol = debugRequested && debugAllowed;

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

        const now = Date.now();

        // Cache only the lean payload (no raw E-Control data) to keep memory usage down.
        let cached: CacheEntry | undefined;
        let cacheKey: string | null = null;
        if (!includeEcontrol) {
            cleanupCache();
            cacheKey = buildCacheKey({
                south,
                west,
                north,
                east,
                centerLat,
                centerLon,
                includeClosed,
            });
            cached = cache.get(cacheKey);

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
        }

        const econtrolStations = await fetchStationsForBounds({
            bounds: { south, west, north, east },
            center: { lat: centerLat, lon: centerLon },
            includeClosed,
        });

        const stations = econtrolStations
            .map((s) => toStationDto(s, includeEcontrol))
            .filter((s): s is Station => s !== null);

        if (!includeEcontrol && cacheKey) {
            cache.set(cacheKey, {
                data: stations,
                expiresAt: now + CACHE_TTL_MS,
            });
            cleanupCache();
        }

        return NextResponse.json(
            {
                stations,
                cached: false,
                pricingSource: "E-Control",
                includeClosed,
            },
            {
                headers: {
                    // Debug payload contains raw upstream data; never allow caching in browsers/CDNs.
                    "Cache-Control": includeEcontrol
                        ? "no-store"
                        : "public, max-age=300, stale-while-revalidate=900",
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
