type BrandMatch = {
    brandName: string;
    domain: string;
};

const BRAND_RULES: Array<{ brandName: string; domain: string; patterns: RegExp[] }> = [
    { brandName: "OMV", domain: "omv.at", patterns: [/\bomv\b/i, /\bavanti\b/i] },
    { brandName: "JET", domain: "jet-austria.at", patterns: [/\bjet\b/i] },
    { brandName: "Shell", domain: "shell.com", patterns: [/\bshell\b/i] },
    { brandName: "BP", domain: "bp.com", patterns: [/\bbp\b/i] },
    { brandName: "Turmoel", domain: "turmoel.at", patterns: [/turm(?:oel|\u00f6l)/i] },
    { brandName: "pink", domain: "pink-tankstellen.at", patterns: [/\bpink\b/i] },
    { brandName: "eni", domain: "eni.com", patterns: [/\beni\b/i] },
    { brandName: "TotalEnergies", domain: "totalenergies.com", patterns: [/\btotal\b/i, /totalenergies/i] },
    { brandName: "Aral", domain: "aral.de", patterns: [/\baral\b/i] },
];

function safeTrim(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function firstWord(value: string): string {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    return parts[0] ?? "";
}

function normalizeLogoKey(value: string): string | null {
    const raw = value.trim().toLowerCase();
    if (!raw) return null;

    // Keep it compatible with /api/logo "domain" parameter and local filenames.
    const cleaned = raw.replace(/[^a-z0-9.-]+/g, "");
    if (!cleaned) return null;
    if (cleaned.startsWith(".") || cleaned.endsWith(".")) return null;
    if (cleaned.includes("..")) return null;
    return cleaned;
}

function tryParseDomainFromWebsite(website: unknown): string | null {
    const raw = safeTrim(website);
    if (!raw) return null;

    const withProto =
        raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;

    try {
        const url = new URL(withProto);
        return url.hostname.replace(/^www\./i, "") || null;
    } catch {
        return null;
    }
}

function tryParseDomainFromEmail(email: unknown): string | null {
    const raw = safeTrim(email);
    if (!raw) return null;

    // Handles plain addresses and common "Name <addr@domain>" formats.
    const match = raw.match(/@([^>\s]+)\s*>?$/);
    const domain = (match?.[1] ?? "").trim();
    return domain ? domain.replace(/^www\./i, "") : null;
}

function detectBrandByName(name: string): BrandMatch | null {
    const trimmed = name.trim();
    if (!trimmed) return null;

    for (const rule of BRAND_RULES) {
        if (rule.patterns.some((p) => p.test(trimmed))) {
            return { brandName: rule.brandName, domain: rule.domain };
        }
    }

    return null;
}

function buildLogoUrl(domain: string): string {
    // Route through our own proxy endpoint. It can cache and hide API tokens.
    return `/api/logo?domain=${encodeURIComponent(domain)}`;
}

export function resolveStationBrandAndLogo(args: {
    stationName?: string | null;
    website?: string | null;
    email?: string | null;
}): { brandName: string | null; domain: string | null; logoUrl: string | null } {
    const name = safeTrim(args.stationName);
    const word = firstWord(name);

    const websiteDomain = tryParseDomainFromWebsite(args.website);
    if (websiteDomain) {
        return {
            // Prefer the first word of the station name for logo lookup (e.g. "Avanti"),
            // and keep the website domain only as a fallback.
            brandName: word || null,
            domain: websiteDomain,
            logoUrl: word
                ? `/api/logo?name=${encodeURIComponent(word)}&domain=${encodeURIComponent(websiteDomain)}`
                : buildLogoUrl(websiteDomain),
        };
    }

    // No website: use the first word of the name (per requirement).
    const first = word;

    // If there is no website, fall back to the email domain if available.
    const emailDomain = tryParseDomainFromEmail(args.email);
    if (emailDomain) {
        return {
            brandName: first || null,
            domain: emailDomain,
            logoUrl: first
                ? `/api/logo?domain=${encodeURIComponent(emailDomain)}&name=${encodeURIComponent(first)}`
                : buildLogoUrl(emailDomain),
        };
    }

    const match = first ? detectBrandByName(first) : null;
    if (match) {
        return {
            brandName: first || match.brandName,
            domain: match.domain,
            logoUrl: first ? `/api/logo?name=${encodeURIComponent(first)}&domain=${encodeURIComponent(match.domain)}` : buildLogoUrl(match.domain),
        };
    }

    const key = normalizeLogoKey(first);
    if (!key) return { brandName: null, domain: null, logoUrl: null };

    return {
        brandName: first || null,
        domain: key,
        logoUrl: `/api/logo?name=${encodeURIComponent(first)}&domain=${encodeURIComponent(key)}`,
    };
}
