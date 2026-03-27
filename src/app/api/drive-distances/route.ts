import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Destination = { id: string; lat: number; lon: number };

type CacheEntry = {
    data: Record<string, { distanceKm: number | null; durationMin: number | null }>;
    expiresAt: number;
};

const OSRM_BASE = "https://router.project-osrm.org";
const CACHE_TTL_MS = 1000 * 20; // short TTL; user location updates frequently
const cache = new Map<string, CacheEntry>();

function roundCoord(value: number, digits = 4): number {
    return Number(value.toFixed(digits));
}

function buildKey(origin: { lat: number; lon: number }, destinations: Destination[]) {
    const o = `${roundCoord(origin.lat)}:${roundCoord(origin.lon)}`;
    const d = destinations
        .map((x) => `${x.id}:${roundCoord(x.lat)}:${roundCoord(x.lon)}`)
        .join("|");
    return `${o}=>${d}`;
}

function isFiniteNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

function parseCoordPair(
    lat: unknown,
    lon: unknown
): { lat: number; lon: number } | null {
    if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) return null;
    if (lat < -90 || lat > 90) return null;
    if (lon < -180 || lon > 180) return null;
    return { lat, lon };
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as unknown;
        const origin = (body as { origin?: unknown }).origin as { lat?: unknown; lon?: unknown } | undefined;
        const destinations = (body as { destinations?: unknown }).destinations as unknown;

        const originPair = origin ? parseCoordPair(origin.lat, origin.lon) : null;
        if (!originPair || !Array.isArray(destinations)) {
            return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
        }

        const dests: Destination[] = destinations
            .map((d): Destination | null => {
                const dd = d as { id?: unknown; lat?: unknown; lon?: unknown };
                const id = typeof dd.id === "string" ? dd.id : null;
                if (!id) return null;
                const pair = parseCoordPair(dd.lat, dd.lon);
                if (!pair) return null;
                return { id, lat: pair.lat, lon: pair.lon };
            })
            .filter((x): x is Destination => x !== null);

        // Keep this small: OSRM public has limits and we don't need full list accuracy.
        const MAX_DESTS = 20;
        const limited = dests.slice(0, MAX_DESTS);
        if (limited.length === 0) {
            return NextResponse.json({ distances: {} });
        }

        const key = buildKey({ lat: originPair.lat, lon: originPair.lon }, limited);
        const now = Date.now();
        const cached = cache.get(key);
        if (cached && cached.expiresAt > now) {
            return NextResponse.json({ distances: cached.data, cached: true });
        }

        // OSRM table:
        // /table/v1/{profile}/{coords}?sources=0&destinations=1;2;...&annotations=distance,duration
        const coords: string[] = [`${originPair.lon},${originPair.lat}`];
        for (const d of limited) coords.push(`${d.lon},${d.lat}`);
        const destinationsParam = limited.map((_, idx) => String(idx + 1)).join(";");
        const url =
            `${OSRM_BASE}/table/v1/driving/${coords.join(";")}` +
            `?sources=0&destinations=${encodeURIComponent(destinationsParam)}` +
            `&annotations=distance,duration`;

        const res = await fetch(url, {
            // Avoid caching at fetch layer; we handle our own short cache.
            cache: "no-store",
        });
        if (!res.ok) {
            return NextResponse.json({ error: `OSRM_${res.status}` }, { status: 502 });
        }

        const json = (await res.json()) as {
            distances?: unknown;
            durations?: unknown;
        };

        const distancesRow = (() => {
            const root = json.distances;
            if (!Array.isArray(root)) return null;
            const first = root[0];
            return Array.isArray(first) ? first : null;
        })();
        const durationsRow = (() => {
            const root = json.durations;
            if (!Array.isArray(root)) return null;
            const first = root[0];
            return Array.isArray(first) ? first : null;
        })();

        const out: CacheEntry["data"] = {};
        for (let i = 0; i < limited.length; i++) {
            const id = limited[i].id;
            const distM = distancesRow ? distancesRow[i] : null;
            const durS = durationsRow ? durationsRow[i] : null;
            out[id] = {
                distanceKm: typeof distM === "number" && Number.isFinite(distM) ? distM / 1000 : null,
                durationMin: typeof durS === "number" && Number.isFinite(durS) ? durS / 60 : null,
            };
        }

        cache.set(key, { data: out, expiresAt: now + CACHE_TTL_MS });

        return NextResponse.json({ distances: out, cached: false });
    } catch (e) {
        console.error("drive-distances error", e);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
