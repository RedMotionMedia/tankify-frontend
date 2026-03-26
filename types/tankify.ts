import type { EControlGasStation } from "@/types/econtrol";

export type Language = "de" | "en";

// ISO 4217 currency code (e.g. "EUR", "USD", "CHF").
export type CurrencySystem = string;
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

export type StationOpeningHour = {
    day: string;
    from: string | null;
    to: string | null;
    label?: string | null;
    order?: number | null;
};

export type StationContact = {
    telephone?: string | null;
    fax?: string | null;
    mail?: string | null;
    website?: string | null;
};

export type StationPaymentMethods = {
    cash?: boolean | null;
    debitCard?: boolean | null;
    creditCard?: boolean | null;
    others?: string | null;
};

export type Station = {
    id: string;
    lat: number;
    lon: number;
    name: string;
    address?: string;
    postalCode?: string;
    city?: string;
    diesel?: number | null;
    super95?: number | null;
    open?: boolean | null;
    distanceKm?: number | null;
    source?: "econtrol";
    brandName?: string | null;
    logoUrl?: string | null;
    openingHours?: StationOpeningHour[];
    contact?: StationContact;
    paymentMethods?: StationPaymentMethods;
    otherServiceOffers?: string | null;
    econtrol?: EControlGasStation;
};

export type MapPickMode = "start" | "end" | null;
