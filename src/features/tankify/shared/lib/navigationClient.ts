"use client";

import { Station } from "@/features/tankify/shared/types/tankify";
import { getGoogleMapsNavigationUrl } from "@/features/tankify/shared/lib/navigation";

// Default to Google Maps across platforms.
export function getSystemNavigationUrl(station: Station): string {
    return getGoogleMapsNavigationUrl(station);
}
