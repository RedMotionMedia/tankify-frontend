import type {
    EControlGasStation,
    EControlPrice,
} from "../../shared/types/econtrol";

export type Bounds = {
    south: number;
    west: number;
    north: number;
    east: number;
};

type FetchByAddressArgs = {
    fuelType: "DIE" | "SUP";
    latitude: number;
    longitude: number;
    includeClosed: boolean;
};

type FetchForBoundsArgs = {
    bounds: Bounds;
    center: { lat: number; lon: number };
    includeClosed: boolean;
};

const ECONTROL_BY_ADDRESS_URL =
    "https://api.e-control.at/sprit/1.0/search/gas-stations/by-address";

function roundCoord(value: number, digits = 2): number {
    return Number(value.toFixed(digits));
}

function toRadians(value: number): number {
    return (value * Math.PI) / 180;
}

function approxKmInBounds(bounds: Bounds): { widthKm: number; heightKm: number } {
    const meanLat = (bounds.north + bounds.south) / 2;
    const kmPerDegLat = 111.32;
    const kmPerDegLon = 111.32 * Math.cos(toRadians(meanLat));

    return {
        widthKm: Math.abs(bounds.east - bounds.west) * kmPerDegLon,
        heightKm: Math.abs(bounds.north - bounds.south) * kmPerDegLat,
    };
}

function isInBounds(station: { lat: number; lon: number }, bounds: Bounds): boolean {
    return (
        station.lat >= bounds.south &&
        station.lat <= bounds.north &&
        station.lon >= bounds.west &&
        station.lon <= bounds.east
    );
}

function getLatLon(station: EControlGasStation): { lat: number; lon: number } | null {
    const lat = station.location?.latitude;
    const lon = station.location?.longitude;

    if (typeof lat !== "number" || typeof lon !== "number") return null;
    return { lat, lon };
}

function mergePrices(a: EControlPrice[] | undefined, b: EControlPrice[] | undefined) {
    const all = [...(a ?? []), ...(b ?? [])];
    const byFuel = new Map<string, EControlPrice>();

    for (const p of all) {
        const key = String(p.fuelType ?? "");
        if (!key) continue;

        if (!byFuel.has(key)) {
            byFuel.set(key, p);
            continue;
        }

        const current = byFuel.get(key)!;

        // Prefer entries with a numeric amount; otherwise keep the first.
        const nextHasAmount = typeof p.amount === "number";
        const curHasAmount = typeof current.amount === "number";
        if (nextHasAmount && !curHasAmount) byFuel.set(key, p);
    }

    // Keep also prices without fuelType (rare/unknown) at the end.
    const noKey = all.filter((p) => !p.fuelType);
    return [...byFuel.values(), ...noKey];
}

function mergeStations(a: EControlGasStation, b: EControlGasStation): EControlGasStation {
    return {
        ...a,
        ...b,
        id: b.id ?? a.id,
        name: b.name ?? a.name,
        open: b.open ?? a.open,
        distance:
            typeof b.distance === "number"
                ? b.distance
                : typeof a.distance === "number"
                    ? a.distance
                    : undefined,
        position:
            typeof b.position === "number"
                ? b.position
                : typeof a.position === "number"
                    ? a.position
                    : undefined,
        otherServiceOffers:
            (b.otherServiceOffers?.length ?? 0) >= (a.otherServiceOffers?.length ?? 0)
                ? b.otherServiceOffers ?? a.otherServiceOffers
                : a.otherServiceOffers ?? b.otherServiceOffers,
        location: {
            ...(a.location ?? {}),
            ...(b.location ?? {}),
        },
        contact: {
            ...(a.contact ?? {}),
            ...(b.contact ?? {}),
        },
        offerInformation: {
            ...(a.offerInformation ?? {}),
            ...(b.offerInformation ?? {}),
        },
        paymentMethods: {
            ...(a.paymentMethods ?? {}),
            ...(b.paymentMethods ?? {}),
        },
        paymentArrangements: {
            ...(a.paymentArrangements ?? {}),
            ...(b.paymentArrangements ?? {}),
        },
        openingHours:
            Array.isArray(b.openingHours) && b.openingHours.length > 0
                ? b.openingHours
                : Array.isArray(a.openingHours)
                    ? a.openingHours
                    : undefined,
        prices: mergePrices(a.prices, b.prices),
    };
}

function dedupeStations(stations: EControlGasStation[]): EControlGasStation[] {
    const map = new Map<string, EControlGasStation>();

    for (const station of stations) {
        const coords = getLatLon(station);
        if (!coords) continue;

        const key = `${roundCoord(coords.lat, 5)}:${roundCoord(coords.lon, 5)}`;
        const current = map.get(key);

        if (!current) {
            map.set(key, station);
            continue;
        }

        map.set(key, mergeStations(current, station));
    }

    return [...map.values()];
}

async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += limit) {
        const chunk = items.slice(i, i + limit);
        const chunkResults = await Promise.all(chunk.map(fn));
        results.push(...chunkResults);
    }

    return results;
}

async function fetchByAddress(args: FetchByAddressArgs): Promise<EControlGasStation[]> {
    const params = new URLSearchParams({
        fuelType: args.fuelType,
        latitude: String(args.latitude),
        longitude: String(args.longitude),
        includeClosed: args.includeClosed ? "true" : "false",
    });

    const url = `${ECONTROL_BY_ADDRESS_URL}?${params.toString()}`;
    const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
    });

    if (!res.ok) {
        const text = await res.text();
        console.warn("E-Control request failed", res.status, text.slice(0, 250));
        return [];
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
        const text = await res.text();
        console.warn("E-Control returned non-JSON", text.slice(0, 250));
        return [];
    }

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];

    return data as EControlGasStation[];
}

async function fetchEnrichedAtPoint(
    lat: number,
    lon: number,
    includeClosed: boolean
): Promise<EControlGasStation[]> {
    const [diesel, super95] = await Promise.all([
        fetchByAddress({ fuelType: "DIE", latitude: lat, longitude: lon, includeClosed }),
        fetchByAddress({ fuelType: "SUP", latitude: lat, longitude: lon, includeClosed }),
    ]);

    return dedupeStations([...diesel, ...super95]);
}

function buildSamplePoints(
    bounds: Bounds,
    center: { lat: number; lon: number }
): Array<{ lat: number; lon: number }> {
    const midLat = (bounds.north + bounds.south) / 2;
    const midLon = (bounds.east + bounds.west) / 2;
    const { widthKm, heightKm } = approxKmInBounds(bounds);
    const maxKm = Math.max(widthKm, heightKm);

    const points: Array<{ lat: number; lon: number }> = [{ ...center }];

    // On small viewports center is enough; larger viewports need sampling at edges.
    if (maxKm > 2) {
        points.push(
            { lat: bounds.north, lon: midLon },
            { lat: bounds.south, lon: midLon },
            { lat: midLat, lon: bounds.east },
            { lat: midLat, lon: bounds.west }
        );
    }

    if (maxKm > 10) {
        points.push(
            { lat: bounds.north, lon: bounds.west },
            { lat: bounds.north, lon: bounds.east },
            { lat: bounds.south, lon: bounds.west },
            { lat: bounds.south, lon: bounds.east }
        );
    }

    const unique = new Map<string, { lat: number; lon: number }>();
    for (const p of points) {
        const key = `${roundCoord(p.lat, 4)}:${roundCoord(p.lon, 4)}`;
        unique.set(key, p);
    }

    return [...unique.values()];
}

export function extractPriceAmount(
    station: EControlGasStation,
    fuelType: "DIE" | "SUP"
): number | null {
    const prices = Array.isArray(station.prices) ? station.prices : [];
    const amount = prices.find((p) => p.fuelType === fuelType)?.amount;
    return typeof amount === "number" ? amount : null;
}

export async function fetchStationsForBounds(
    args: FetchForBoundsArgs
): Promise<EControlGasStation[]> {
    const samplePoints = buildSamplePoints(args.bounds, args.center);

    const perPoint = await mapWithConcurrency(samplePoints, 3, (p) =>
        fetchEnrichedAtPoint(p.lat, p.lon, args.includeClosed)
    );

    const stations = dedupeStations(perPoint.flat()).filter((s) => {
        const coords = getLatLon(s);
        return coords ? isInBounds(coords, args.bounds) : false;
    });

    // Stable ordering for UI: prefer stations with any known price, then by name.
    stations.sort((a, b) => {
        const aHasPrice =
            extractPriceAmount(a, "DIE") != null || extractPriceAmount(a, "SUP") != null;
        const bHasPrice =
            extractPriceAmount(b, "DIE") != null || extractPriceAmount(b, "SUP") != null;

        if (aHasPrice !== bHasPrice) return aHasPrice ? -1 : 1;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""), "de");
    });

    return stations;
}
