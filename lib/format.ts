import { Language } from "@/types/tankify";

export function formatCurrency(value: number, language: Language) {
    return new Intl.NumberFormat(language === "de" ? "de-AT" : "en-US", {
        style: "currency",
        currency: "EUR",
    }).format(value);
}

export function formatDuration(hours: number, language: Language) {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (language === "de") {
        if (h === 0) return `${m} min`;
        return `${h} h ${m} min`;
    }

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

export function formatPrice(value?: number | null) {
    if (value === null || value === undefined) return "—";
    return `${value.toFixed(3)} €`;
}