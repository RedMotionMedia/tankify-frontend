import { NextResponse } from "next/server";
import { normalizeCurrencyCode } from "@/lib/fx";

export const runtime = "nodejs";

type CacheEntry = { data: Record<string, string>; expiresAt: number };
type UnknownRecord = Record<string, unknown>;

const cache: CacheEntry = {
    data: { EUR: "Euro", USD: "US Dollar" },
    expiresAt: 0,
};

const TTL_MS = 1000 * 60 * 60 * 24; // 24h

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
        // Frankfurter has historically returned different shapes depending on version/provider.
        // Support:
        // - Array of objects: [{ iso_code|code, name }, ...]
        // - Object map: { USD: "US Dollar", ... }
        // - Wrapped array: { currencies: [...] } or { data: [...] }
        let arr: Array<UnknownRecord> = [];
        let map: Record<string, string> | null = null;

        if (Array.isArray(json)) {
            arr = json.filter(isRecord);
        } else if (isRecord(json)) {
            const maybeCurrencies = (json as UnknownRecord).currencies;
            const maybeData = (json as UnknownRecord).data;
            if (Array.isArray(maybeCurrencies)) {
                arr = maybeCurrencies.filter(isRecord);
            } else if (Array.isArray(maybeData)) {
                arr = maybeData.filter(isRecord);
            } else {
                // Treat as code->name map if values are strings.
                const tmp: Record<string, string> = {};
                for (const [k, v] of Object.entries(json)) {
                    const code = normalizeCurrencyCode(k);
                    const name = typeof v === "string" ? v.trim() : "";
                    if (!code || !name) continue;
                    tmp[code] = name;
                }
                if (Object.keys(tmp).length > 0) map = tmp;
            }
        }

        const out: Record<string, string> = {};
        if (map) {
            Object.assign(out, map);
        } else {
            for (const item of arr) {
                const rawCode =
                    typeof item.iso_code === "string"
                        ? item.iso_code
                        : typeof item.code === "string"
                            ? item.code
                            : "";
                const code = normalizeCurrencyCode(rawCode);
                const name = typeof item.name === "string" ? item.name.trim() : "";
                if (!code || !name) continue;
                out[code] = name;
            }
        }

        // Keep a small fallback set if the upstream ever changes.
        if (!out.EUR) out.EUR = "Euro";
        if (!out.USD) out.USD = "US Dollar";

        // Only cache long-term when we actually received more than the hard fallback.
        const keys = Object.keys(out);
        const looksLikeFallbackOnly = keys.length <= 2 && !!out.EUR && !!out.USD;
        cache.data = out;
        cache.expiresAt = now + (looksLikeFallbackOnly ? 1000 * 60 * 5 : TTL_MS); // 5m vs 24h

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
