import type { NextConfig } from "next";

function parseCsvEnv(name: string): string[] {
    const raw = process.env[name] ?? "";
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

const nextConfig: NextConfig = {
    ...(process.env.NODE_ENV === "development"
        ? {
              // Keep repo defaults stable; add machine-specific origins via env.
              // Example:
              // NEXT_ALLOWED_DEV_ORIGINS=dev.redmotionmedia.com,10.0.0.3
              allowedDevOrigins: Array.from(
                  new Set([
                      "dev.redmotionmedia.com",
                      ...parseCsvEnv("NEXT_ALLOWED_DEV_ORIGINS"),
                  ])
              ),
          }
        : {}),
};

export default nextConfig;
