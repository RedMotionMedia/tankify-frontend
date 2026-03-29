import { NextRequest, NextResponse } from "next/server";

type IpLocationResponse = { lat: number; lon: number; source: "ip" };

function firstForwardedFor(req: NextRequest): string | null {
    const xf = req.headers.get("x-forwarded-for");
    if (!xf) return null;
    const first = xf.split(",")[0]?.trim();
    return first || null;
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
    return false;
}

async function lookupIpWhoIs(ipOrNull: string | null): Promise<{ lat: number; lon: number } | null> {
    const url = ipOrNull ? `https://ipwho.is/${encodeURIComponent(ipOrNull)}` : "https://ipwho.is/";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<{
        success: boolean;
        latitude: number;
        longitude: number;
    }>;
    if (data.success === false) return null;
    const lat = typeof data.latitude === "number" ? data.latitude : Number.NaN;
    const lon = typeof data.longitude === "number" ? data.longitude : Number.NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
}

export async function GET(req: NextRequest) {
    try {
        const ip =
            firstForwardedFor(req) ??
            req.headers.get("x-real-ip") ??
            req.headers.get("cf-connecting-ip") ??
            null;

        // In local dev the best we can do is to call ipwho.is without an explicit IP.
        // In production behind a proxy/CDN, forwarded headers should carry the actual client IP.
        const ipForLookup = ip && !isProbablyPrivateIp(ip) ? ip : null;

        const loc = await lookupIpWhoIs(ipForLookup);
        if (!loc) return new NextResponse(null, { status: 204 });

        const body: IpLocationResponse = { lat: loc.lat, lon: loc.lon, source: "ip" };
        return NextResponse.json(body, {
            headers: {
                "Cache-Control": "private, max-age=300",
            },
        });
    } catch {
        return new NextResponse(null, { status: 204 });
    }
}
