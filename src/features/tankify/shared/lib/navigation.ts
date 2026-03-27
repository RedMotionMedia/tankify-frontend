import { Station } from "@/features/tankify/shared/types/tankify";

function encodeLabel(station: Station): string {
    const parts = [station.name, station.address, station.postalCode, station.city].filter(Boolean);
    return parts.join(", ");
}

// Google Maps: open directions to destination (origin defaults to current location).
export function getGoogleMapsNavigationUrl(station: Station): string {
    const dest = `${station.lat},${station.lon}`;
    // dir_action=navigate hints mobile apps to enter navigation mode.
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving&dir_action=navigate`;
}

// Apple Maps: open directions to destination (origin defaults to current location).
export function getAppleMapsNavigationUrl(station: Station): string {
    const daddr = `${station.lat},${station.lon}`;
    const q = encodeURIComponent(encodeLabel(station));
    // dirflg=d => driving directions
    return `https://maps.apple.com/?daddr=${encodeURIComponent(daddr)}&q=${q}&dirflg=d`;
}
