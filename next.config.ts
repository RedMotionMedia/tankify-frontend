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
              allowedDevOrigins: Array.from(
                  new Set([
                      ...parseCsvEnv("NEXT_ALLOWED_DEV_ORIGINS"),
                  ])
              ),
          }
        : {}),
};

export default nextConfig;
