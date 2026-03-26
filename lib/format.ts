import { CurrencySystem } from "@/types/tankify";

export function formatCurrency(value: number, currencySystem: CurrencySystem) {
    // Use the user's locale by default; currency code drives formatting.
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencySystem,
    }).format(value);
}

export function formatDuration(hours: number) {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (h === 0) return `${m} min`;
    return `${h} h ${m} min`;
}

export function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function formatInputValue(value: number, step: number) {
    if (step >= 1) return value.toFixed(0);
    if (step >= 0.1) return value.toFixed(1);
    return value.toFixed(3);
}

export function formatPrice(value?: number | null, currencySystem: CurrencySystem = "EUR") {
    if (value === null || value === undefined) return "-";
    // Keep 3 decimals for fuel prices; code is clearer than symbols across many currencies.
    return `${value.toFixed(3)} ${currencySystem}`;
}

