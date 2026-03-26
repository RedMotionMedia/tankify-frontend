import { NextResponse } from "next/server";
import { normalizeCurrencyCode } from "@/lib/fx";

export const runtime = "nodejs";

type CacheEntry = { data: Record<string, string>; expiresAt: number };

const cache: CacheEntry = {
    data: { EUR: "Euro", USD: "US Dollar" },
    expiresAt: 0,
};

const TTL_MS = 1000 * 60 * 60 * 24; // 24h

export async function GET() {
    const now = Date.now();
    if (cache.expiresAt > now) {
        return NextResponse.json({ currencies: cache.data, cached: true });
    }

    try {
        // Frankfurter is ECB-based, free, and doesn't require an API key.
        const res = await fetch("https://api.frankfurter.dev/v2/currencies", {
            headers: { Accept: "application/json" },
        });

        if (!res.ok) {
            throw new Error(`fx currencies fetch failed: ${res.status}`);
        }

        const json = (await res.json()) as unknown;
        const obj = json as Record<string, unknown>;

        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj)) {
            const code = normalizeCurrencyCode(k);
            const name = typeof v === "string" ? v.trim() : "";
            if (!code || !name) continue;
            out[code] = name;
        }

        // Keep a small fallback set if the upstream ever changes.
        if (!out.EUR) out.EUR = "Euro";
        if (!out.USD) out.USD = "US Dollar";

        cache.data = out;
        cache.expiresAt = now + TTL_MS;

        return NextResponse.json({ currencies: out, cached: false });
    } catch {
        // Serve stale cache if available.
        if (Object.keys(cache.data).length > 0) {
            cache.expiresAt = now + Math.min(TTL_MS, 1000 * 60 * 10);
            return NextResponse.json({ currencies: cache.data, cached: true, stale: true });
        }

        return NextResponse.json(
            { error: "FX_CURRENCIES_UNAVAILABLE" },
            { status: 503 }
        );
    }
}
