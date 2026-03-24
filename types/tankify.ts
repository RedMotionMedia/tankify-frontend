export type Language = "de" | "en";

export type CurrencySystem = "eur" | "usd";
export type MeasurementSystem = "metric" | "imperial";

export type FuelType = "diesel" | "super95";

export type Point = {
    lat: number;
    lon: number;
    label: string;
};

export type GeocodeResult = {
    display_name: string;
    lat: string;
    lon: string;
};

export type RouteData = {
    distanceKm: number;
    durationHours: number;
    geometry: [number, number][];
};

export type Station = {
    id: string;
    lat: number;
    lon: number;
    name: string;
    address?: string;
    city?: string;
    diesel?: number | null;
    super95?: number | null;
    open?: boolean | null;
    source?: "econtrol";
};

export type MapPickMode = "start" | "end" | null;
