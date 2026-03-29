import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type IpLocationOkResponse = {
    ok: true;
    lat: number;
    lon: number;
    source: "ip";
    provider: "ipwho.is" | "ipapi.co";
    ipUsed: string | null;
};

type IpLocationErrorResponse = {
    ok: false;
    ipUsed: string | null;
    error: {
        type: "rate_limited" | "blocked" | "unreachable" | "invalid_ip" | "unknown";
        message: string;
        statusHint?: number;
    };
    tried: ProviderDebug[];
};

function normalizeIp(raw: string | null): string | null {
    if (!raw) return null;
    const v = raw.trim();
    if (!v) return null;
    // Strip IPv4 ":port" if present.
    if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(v)) return v.split(":")[0] ?? null;
    // Strip brackets for IPv6 like "[::1]"
    if (v.startsWith("[") && v.endsWith("]")) return v.slice(1, -1);
    return v;
}

function firstForwardedFor(req: NextRequest): string | null {
    const xf = req.headers.get("x-forwarded-for");
    if (!xf) return null;
    const first = xf.split(",")[0]?.trim();
    return first || null;
}

function firstPublicForwardedFor(req: NextRequest): string | null {
    const xf = req.headers.get("x-forwarded-for");
    if (!xf) return null;
    for (const part of xf.split(",")) {
        const ip = normalizeIp(part.trim());
        if (!ip) continue;
        if (!/^[0-9a-fA-F:.]+$/.test(ip)) continue;
        if (isProbablyPrivateIp(ip)) continue;
        return ip;
    }
    return null;
}

function isProbablyPrivateIp(ip: string): boolean {
    // Minimal IPv4 private range detection (good enough for our use).
    if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        const [a, b] = ip.split(".").map((x) => Number(x));
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 192 && b === 168) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
    }
    // IPv6 localhost / unique local addresses
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe80:")) return true; // IPv6 link-local
    return false;
}

type ProviderDebug = {
    provider: "ipwho.is" | "ipapi.co";
    url: string;
    status?: number;
    ok?: boolean;
    error?: string;
    message?: string;
};

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<{ res: Response; text: string }> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" },
        });
        const text = await res.text();
        return { res, text };
    } finally {
        clearTimeout(t);
    }
}

async function lookupIpWhoIs(
    ipOrNull: string | null,
    debug: ProviderDebug[]
): Promise<{ lat: number; lon: number } | null> {
    const url = ipOrNull ? `https://ipwho.is/${encodeURIComponent(ipOrNull)}` : "https://ipwho.is/";
    try {
        const { res, text } = await fetchJsonWithTimeout(url, 6500);
        const entry: ProviderDebug = { provider: "ipwho.is", url, status: res.status, ok: res.ok };
        debug.push(entry);
        if (!res.ok) return null;
        const data = JSON.parse(text) as Partial<{
            success: boolean;
            message: string;
            latitude: number;
            longitude: number;
        }>;
        if (data.success === false) {
            entry.message = typeof data.message === "string" ? data.message : undefined;
            return null;
        }
        const lat = typeof data.latitude === "number" ? data.latitude : Number.NaN;
        const lon = typeof data.longitude === "number" ? data.longitude : Number.NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { lat, lon };
    } catch (e) {
        debug.push({
            provider: "ipwho.is",
            url,
            error: e instanceof Error ? e.message : "LOOKUP_FAILED",
        });
        return null;
    }
}

async function lookupIpApiCo(
    ipOrNull: string | null,
    debug: ProviderDebug[]
): Promise<{ lat: number; lon: number } | null> {
    const url = ipOrNull
        ? `https://ipapi.co/${encodeURIComponent(ipOrNull)}/json/`
        : "https://ipapi.co/json/";
    try {
        const { res, text } = await fetchJsonWithTimeout(url, 6500);
        const entry: ProviderDebug = { provider: "ipapi.co", url, status: res.status, ok: res.ok };
        debug.push(entry);
        if (!res.ok) return null;
        const data = JSON.parse(text) as Partial<{
            error: boolean;
            reason: string;
            latitude: number | string;
            longitude: number | string;
        }>;
        if (data.error) {
            entry.message = typeof data.reason === "string" ? data.reason : undefined;
            return null;
        }
        const lat =
            typeof data.latitude === "number"
                ? data.latitude
                : typeof data.latitude === "string"
                    ? Number(data.latitude)
                    : Number.NaN;
        const lon =
            typeof data.longitude === "number"
                ? data.longitude
                : typeof data.longitude === "string"
                    ? Number(data.longitude)
                    : Number.NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { lat, lon };
    } catch (e) {
        debug.push({
            provider: "ipapi.co",
            url,
            error: e instanceof Error ? e.message : "LOOKUP_FAILED",
        });
        return null;
    }
}

export async function GET(req: NextRequest) {
    const urlObj = new URL(req.url);
    const { searchParams } = urlObj;
    const debug: ProviderDebug[] = [];

    try {
        const ipParam = normalizeIp(searchParams.get("ip"));
        const ipFromParam =
            ipParam && !isProbablyPrivateIp(ipParam) && /^[0-9a-fA-F:.]+$/.test(ipParam)
                ? ipParam
                : null;

        const ip =
            firstPublicForwardedFor(req) ??
            normalizeIp(firstForwardedFor(req)) ??
            normalizeIp(req.headers.get("cf-connecting-ip")) ??
            normalizeIp(req.headers.get("x-real-ip")) ??
            null;

        // In local dev the best we can do is to call ipwho.is without an explicit IP.
        // In production behind a proxy/CDN, forwarded headers should carry the actual client IP.
        const ipForLookup = ipFromParam ?? (ip && !isProbablyPrivateIp(ip) ? ip : null);

        if (ipParam && !ipFromParam) {
            const body: IpLocationErrorResponse = {
                ok: false,
                ipUsed: null,
                error: {
                    type: "invalid_ip",
                    message: "Invalid or private IP address was provided.",
                    statusHint: 400,
                },
                tried: debug,
            };
            return NextResponse.json(body, {
                status: 400,
                headers: { "Cache-Control": "no-store" },
            });
        }

        const who = await lookupIpWhoIs(ipForLookup, debug);
        if (who) {
            const body: IpLocationOkResponse = {
                ok: true,
                lat: who.lat,
                lon: who.lon,
                source: "ip",
                provider: "ipwho.is",
                ipUsed: ipForLookup,
            };
            return NextResponse.json(body, {
                headers: { "Cache-Control": "private, max-age=300" },
            });
        }

        const apiCo = await lookupIpApiCo(ipForLookup, debug);
        if (apiCo) {
            const body: IpLocationOkResponse = {
                ok: true,
                lat: apiCo.lat,
                lon: apiCo.lon,
                source: "ip",
                provider: "ipapi.co",
                ipUsed: ipForLookup,
            };
            return NextResponse.json(body, {
                headers: { "Cache-Control": "private, max-age=300" },
            });
        }

        const statuses = debug.map((d) => d.status).filter((s): s is number => typeof s === "number");
        const has429 = statuses.includes(429);
        const has403 = statuses.includes(403);
        const has5xx = statuses.some((s) => s >= 500 && s <= 599);
        const hasAnyResponse = statuses.length > 0;

        const type: IpLocationErrorResponse["error"]["type"] = has429
            ? "rate_limited"
            : has403
                ? "blocked"
                : hasAnyResponse
                    ? "unknown"
                    : "unreachable";
        const statusHint = has429 ? 429 : has403 ? 403 : has5xx ? 503 : 502;
        const message =
            type === "rate_limited"
                ? "IP location provider rate-limited this server/IP (HTTP 429). Try again later."
                : type === "blocked"
                    ? "IP location provider blocked this server/IP (HTTP 403)."
                    : type === "unreachable"
                        ? "Could not reach IP location providers (network/DNS/timeout)."
                        : "IP location providers responded but no coordinates were returned.";

        const body: IpLocationErrorResponse = {
            ok: false,
            ipUsed: ipForLookup,
            error: { type, message, statusHint },
            tried: debug,
        };

        // In normal mode we still return JSON so the UI can show a meaningful error.
        // If someone wants the old behavior they can ignore the body.
        return NextResponse.json(body, {
            status: statusHint,
            headers: { "Cache-Control": "no-store" },
        });

    } catch (e) {
        const body: IpLocationErrorResponse = {
            ok: false,
            ipUsed: null,
            error: {
                type: "unknown",
                message: e instanceof Error ? e.message : "UNKNOWN_ERROR",
                statusHint: 500,
            },
            tried: debug,
        };
        return NextResponse.json(body, {
            status: 500,
            headers: { "Cache-Control": "no-store" },
        });
    }
}
