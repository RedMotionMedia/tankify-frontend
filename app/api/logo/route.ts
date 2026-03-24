import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type CacheEntry = {
    body: ArrayBuffer;
    contentType: string;
    etag: string;
    expiresAt: number;
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const MAX_ENTRIES = 300;

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

function normalizeKey(raw: string | null): string | null {
    if (!raw) return null;
    const d = raw.trim().toLowerCase();
    if (!d) return null;

    // Keep it strict: hostnames only.
    if (!/^[a-z0-9.-]{1,253}$/.test(d)) return null;
    if (d.includes("..")) return null;
    if (d.startsWith(".") || d.endsWith(".")) return null;
    return d;
}

function normalizeNameKey(raw: string | null): string | null {
    if (!raw) return null;

    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return null;

    const translit = trimmed
        .replaceAll("ä", "ae")
        .replaceAll("ö", "oe")
        .replaceAll("ü", "ue")
        .replaceAll("ß", "ss")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "");

    const cleaned = translit.replace(/[^a-z0-9.-]+/g, "");
    if (!cleaned) return null;

    if (!/^[a-z0-9.-]{1,253}$/.test(cleaned)) return null;
    if (cleaned.includes("..")) return null;
    if (cleaned.startsWith(".") || cleaned.endsWith(".")) return null;

    return cleaned;
}

function buildExternalDomainLogoUrl(domain: string): string {
    // Clearbit Logo API was shut down in Dec 2025; Logo.dev is a common replacement.
    const token =
        (process.env.LOGO_DEV_TOKEN ?? process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN ?? "").trim();

    if (token) {
        const t = encodeURIComponent(token);
        return `https://img.logo.dev/${domain}?token=${t}&size=96&format=png`;
    }

    // Fallback without token: favicon service.
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

function buildExternalNameLogoUrl(name: string): string | null {
    const token =
        (process.env.LOGO_DEV_TOKEN ?? process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN ?? "").trim();
    if (!token) return null;

    const t = encodeURIComponent(token);
    // Name-based lookup avoids parent-company domains (e.g. "Avanti" vs "omv.com").
    return `https://img.logo.dev/name/${encodeURIComponent(name)}?token=${t}&size=96&format=png`;
}

function computeEtag(body: ArrayBuffer): string {
    const hash = crypto.createHash("sha1").update(Buffer.from(body)).digest("hex");
    return `W/\"${hash}\"`;
}

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
    const out = new Uint8Array(buf.byteLength);
    out.set(buf);
    return out.buffer;
}

function contentTypeForExt(ext: string): string {
    switch (ext) {
        case "svg":
            return "image/svg+xml; charset=utf-8";
        case "webp":
            return "image/webp";
        case "png":
            return "image/png";
        case "jpg":
        case "jpeg":
            return "image/jpeg";
        case "ico":
            return "image/x-icon";
        default:
            return "application/octet-stream";
    }
}

async function tryLoadLocalLogo(key: string): Promise<CacheEntry | null> {
    const baseDir = path.join(process.cwd(), "resources", "logos");
    const exts = ["svg", "webp", "png", "jpg", "jpeg", "ico"] as const;

    for (const ext of exts) {
        const filePath = path.join(baseDir, `${key}.${ext}`);
        try {
            const buf = await fs.readFile(filePath);
            const body = bufferToArrayBuffer(buf);

            return {
                body,
                contentType: contentTypeForExt(ext),
                etag: computeEtag(body),
                expiresAt: Date.now() + CACHE_TTL_MS,
            };
        } catch {
            // Not found, try next extension.
        }
    }

    return null;
}

function putCache(domain: string, entry: CacheEntry) {
    cache.set(domain, entry);

    // Naive LRU: evict oldest insertion-order entries.
    while (cache.size > MAX_ENTRIES) {
        const oldestKey = cache.keys().next().value as string | undefined;
        if (!oldestKey) break;
        cache.delete(oldestKey);
    }
}

async function fetchAndCache(domain: string): Promise<CacheEntry> {
    const url = buildExternalDomainLogoUrl(domain);

    const res = await fetch(url, {
        headers: {
            // Some providers block empty UA. Keep it simple and stable.
            "User-Agent": "tankify/1.0",
            Accept: "image/*,*/*;q=0.8",
        },
    });

    if (!res.ok) {
        throw new Error(`logo fetch failed: ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "image/png";
    const buf = await res.arrayBuffer();

    return {
        body: buf,
        contentType,
        etag: computeEtag(buf),
        expiresAt: Date.now() + CACHE_TTL_MS,
    };
}

async function fetchByUrlAndCache(url: string): Promise<CacheEntry> {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "tankify/1.0",
            Accept: "image/*,*/*;q=0.8",
        },
    });

    if (!res.ok) {
        throw new Error(`logo fetch failed: ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "image/png";
    const buf = await res.arrayBuffer();

    return {
        body: buf,
        contentType,
        etag: computeEtag(buf),
        expiresAt: Date.now() + CACHE_TTL_MS,
    };
}

export async function GET(req: NextRequest) {
    const nameRaw = ((req.nextUrl.searchParams.get("name") ?? "").trim().split(/\s+/)[0] ?? "").trim();
    const nameKey = normalizeNameKey(nameRaw);

    const domainKey = normalizeKey(req.nextUrl.searchParams.get("domain"));

    if (!nameKey && !domainKey) {
        return new NextResponse("Missing/invalid name/domain", { status: 400 });
    }

    const now = Date.now();
    const ifNoneMatch = req.headers.get("if-none-match");

    const respond = (entry: CacheEntry) => {
        if (ifNoneMatch && ifNoneMatch === entry.etag) {
            return new NextResponse(null, { status: 304 });
        }

        return new NextResponse(entry.body, {
            status: 200,
            headers: {
                "Content-Type": entry.contentType,
                ETag: entry.etag,
                "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
            },
        });
    };

    // 1) Prefer local assets (no external request).
    if (domainKey) {
        const localKey = `local:${domainKey}`;
        const cachedLocal = cache.get(localKey);
        if (cachedLocal && cachedLocal.expiresAt > now) return respond(cachedLocal);

        const local = await tryLoadLocalLogo(domainKey);
        if (local) {
            putCache(localKey, local);
            return respond(local);
        }
    }

    if (nameKey) {
        const localKey = `local:${nameKey}`;
        const cachedLocal = cache.get(localKey);
        if (cachedLocal && cachedLocal.expiresAt > now) return respond(cachedLocal);

        const local = await tryLoadLocalLogo(nameKey);
        if (local) {
            putCache(localKey, local);
            return respond(local);
        }
    }

    // 2) Name lookup (logo.dev name endpoint; token required).
    if (nameRaw) {
        const nameUrl = buildExternalNameLogoUrl(nameRaw);
        if (nameUrl && nameKey) {
            const nameCacheKey = `name:${nameKey}`;
            const cachedName = cache.get(nameCacheKey);
            if (cachedName && cachedName.expiresAt > now) return respond(cachedName);

            const p =
                inflight.get(nameCacheKey) ??
                fetchByUrlAndCache(nameUrl).finally(() => {
                    inflight.delete(nameCacheKey);
                });

            inflight.set(nameCacheKey, p);

            try {
                const entry = await p;
                putCache(nameCacheKey, entry);
                return respond(entry);
            } catch {
                // ignore
            }
        }
    }

    // 3) Domain lookup (logo.dev domain endpoint or favicon fallback).
    if (domainKey && domainKey.includes(".")) {
        const domainCacheKey = `domain:${domainKey}`;
        const cachedDomain = cache.get(domainCacheKey);
        if (cachedDomain && cachedDomain.expiresAt > now) return respond(cachedDomain);

        const p =
            inflight.get(domainCacheKey) ??
            fetchAndCache(domainKey).finally(() => {
                inflight.delete(domainCacheKey);
            });

        inflight.set(domainCacheKey, p);

        try {
            const entry = await p;
            putCache(domainCacheKey, entry);
            return respond(entry);
        } catch {
            // ignore
        }
    }

    return new NextResponse("Not found", { status: 404 });
}

export async function POST(req: NextRequest) {
    const action = req.nextUrl.searchParams.get("action");
    if (action !== "clear") {
        return new NextResponse("Unknown action", { status: 400 });
    }

    // Safety: avoid exposing cache flush in production unless explicitly enabled.
    const allow =
        (process.env.NEXT_PUBLIC_ENABLE_CACHE_CLEAR ?? "").trim() === "1" ||
        (process.env.ENABLE_CACHE_CLEAR ?? "").trim() === "1";

    if (process.env.NODE_ENV === "production" && !allow) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    cache.clear();

    return NextResponse.json({ ok: true, cleared: true });
}
