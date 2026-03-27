export type FxCurrencies = Record<string, string>; // code -> name

export type FxRateResponse = {
    base: string;
    quote: string;
    rate: number;
    date?: string;
};

export function normalizeCurrencyCode(code: string | null | undefined): string | null {
    const raw = (code ?? "").trim();
    if (!raw) return null;
    const up = raw.toUpperCase();
    if (!/^[A-Z]{3}$/.test(up)) return null;
    return up;
}

export function clampFxRate(rate: unknown): number {
    const n = typeof rate === "number" ? rate : Number.NaN;
    return Number.isFinite(n) && n > 0 ? n : 1;
}

export function eurToQuote(amountEur: number, eurToQuoteRate: number): number {
    return amountEur * clampFxRate(eurToQuoteRate);
}

export function quoteToEur(amountQuote: number, eurToQuoteRate: number): number {
    return amountQuote / clampFxRate(eurToQuoteRate);
}

