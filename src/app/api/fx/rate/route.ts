import { NextRequest, NextResponse } from "next/server";
import { clampFxRate, normalizeCurrencyCode } from "@/features/tankify/shared/lib/fx";

export const runtime = "nodejs";

type CacheKey = `${string}:${string}`;
type CacheEntry = { data: { base: string; quote: string; rate: number; date?: string }; expiresAt: number };

const cache = new Map<CacheKey, CacheEntry>();
const TTL_MS = 1000 * 60 * 60; // 1h
const MAX_CACHE = 200;

function cleanup() {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
        if (v.expiresAt <= now) cache.delete(k);
    }
    if (cache.size <= MAX_CACHE) return;
    const sorted = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (const [k] of sorted.slice(0, cache.size - MAX_CACHE)) cache.delete(k);
}

export async function GET(req: NextRequest) {
    cleanup();

    const base = normalizeCurrencyCode(req.nextUrl.searchParams.get("base")) ?? "EUR";
    const quote = normalizeCurrencyCode(req.nextUrl.searchParams.get("quote")) ?? "EUR";

    if (base === quote) {
        return NextResponse.json({ base, quote, rate: 1, cached: true });
    }

    const key: CacheKey = `${base}:${quote}`;
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
        return NextResponse.json({ ...cached.data, cached: true });
    }

    try {
        const url = `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) {
            throw new Error(`fx rate fetch failed: ${res.status}`);
        }

        const json = (await res.json()) as unknown;
        const obj = json as Record<string, unknown>;
        const rate = clampFxRate(obj.rate);
        const date = typeof obj.date === "string" ? obj.date : undefined;

        const data = { base, quote, rate, date };
        cache.set(key, { data, expiresAt: now + TTL_MS });

        return NextResponse.json({ ...data, cached: false });
    } catch {
        if (cached) {
            // Serve stale rate briefly.
            cache.set(key, { data: cached.data, expiresAt: now + 1000 * 60 * 10 });
            return NextResponse.json({ ...cached.data, cached: true, stale: true });
        }
        return NextResponse.json({ error: "FX_RATE_UNAVAILABLE", base, quote }, { status: 503 });
    }
}
