"use client";

import { useEffect, useState } from "react";
import { TranslationSchema } from "@/features/tankify/shared/config/i18n";
import {
    CurrencySystem,
    FuelType,
    Language,
    MeasurementSystem,
} from "@/features/tankify/shared/types/tankify";
import SliderNumberField from "../ui/SliderNumberField";

type Props = {
    open: boolean;
    onClose: () => void;
    t: TranslationSchema;
    language: Language;
    setLanguage: (language: Language) => void;
    debugAllowed: boolean;
    debugMode: boolean;
    setDebugMode: (value: boolean) => void;
    fuelType: FuelType;
    setFuelType: (value: FuelType) => void;
    currencySystem: CurrencySystem;
    setCurrencySystem: (value: CurrencySystem) => void;
    measurementSystem: MeasurementSystem;
    setMeasurementSystem: (value: MeasurementSystem) => void;
    consumption: number;
    setConsumption: (value: number) => void;
    tankSize: number;
    setTankSize: (value: number) => void;
    avgSpeed: number;
    setAvgSpeed: (value: number) => void;
};

export default function SettingsModal({
                                          open,
                                          onClose,
                                          t,
                                          language,
                                          setLanguage,
                                          debugAllowed,
                                          debugMode,
                                          setDebugMode,
                                          fuelType,
                                          setFuelType,
                                          currencySystem,
                                          setCurrencySystem,
                                          measurementSystem,
                                          setMeasurementSystem,
                                          consumption,
                                          setConsumption,
                                          tankSize,
                                          setTankSize,
                                          avgSpeed,
                                          setAvgSpeed,
                                      }: Props) {
    const [cacheClearing, setCacheClearing] = useState(false);
    const [cacheStatus, setCacheStatus] = useState<"ok" | "error" | null>(null);
    const [fxCurrencies, setFxCurrencies] = useState<Record<string, string> | null>(null);
    const showDebugControls = debugAllowed;
    const appVersion = (process.env.NEXT_PUBLIC_APP_VERSION ?? "").trim() || "dev";

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/fx/currencies");
                if (!res.ok) return;
                const json = (await res.json()) as { currencies?: unknown };
                const obj = json.currencies as Record<string, unknown> | undefined;
                if (!obj) return;

                const out: Record<string, string> = {};
                for (const [k, v] of Object.entries(obj)) {
                    const code = (k ?? "").trim().toUpperCase();
                    const name = typeof v === "string" ? v.trim() : "";
                    if (!/^[A-Z]{3}$/.test(code) || !name) continue;
                    out[code] = name;
                }
                if (cancelled) return;
                if (Object.keys(out).length > 0) setFxCurrencies(out);
            } catch {
                // ignore
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!open) return;

        const scrollY = window.scrollY;
        const originalBodyOverflow = document.body.style.overflow;
        const originalBodyPosition = document.body.style.position;
        const originalBodyTop = document.body.style.top;
        const originalBodyWidth = document.body.style.width;
        const originalBodyLeft = document.body.style.left;
        const originalBodyRight = document.body.style.right;

        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";
        document.body.style.left = "0";
        document.body.style.right = "0";

        return () => {
            document.body.style.overflow = originalBodyOverflow;
            document.body.style.position = originalBodyPosition;
            document.body.style.top = originalBodyTop;
            document.body.style.width = originalBodyWidth;
            document.body.style.left = originalBodyLeft;
            document.body.style.right = originalBodyRight;
            window.scrollTo(0, scrollY);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    async function handleClearLogoCache() {
        setCacheClearing(true);
        setCacheStatus(null);

        try {
            const res = await fetch("/api/logo?action=clear", { method: "POST" });
            if (!res.ok) throw new Error(String(res.status));
            setCacheStatus("ok");

            // Optional: allow other components to react (e.g. re-render markers).
            window.dispatchEvent(new Event("tankify:logo-cache-cleared"));
        } catch {
            setCacheStatus("error");
        } finally {
            setCacheClearing(false);
        }
    }

    return (
        <div
            className={`fixed inset-0 z-3300 flex items-center justify-center p-4 transition duration-200 ${
                open ? "pointer-events-auto" : "pointer-events-none"
            }`}
            aria-hidden={!open}
        >
            <button
                type="button"
                aria-label={t.actions.close}
                className={`absolute inset-0 transition duration-200 ${
                    open ? "bg-black/25 backdrop-blur-sm" : "bg-black/0 backdrop-blur-none"
                }`}
                onClick={onClose}
                tabIndex={open ? 0 : -1}
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-label={t.settings.title}
                onClick={(e) => e.stopPropagation()}
                className={`relative z-3301 max-h-[90dvh] w-[92vw] max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl transition duration-200 sm:p-8 ${
                    open ? "scale-100 opacity-100" : "scale-95 opacity-0"
                }`}
            >
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold">{t.settings.title}</h2>
                        <p className="mt-1 text-sm text-gray-600">
                            {t.app.adjustCalculator}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
                        aria-label={t.actions.close}
                    >
                        ✕
                    </button>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                    <section className="space-y-4">
                        <div>
                            <h3 className="text-lg font-bold">{t.settings.title}</h3>
                        </div>

                        <div className="flex flex-row gap-3">
                            <label className="block py-3 text-sm font-medium">
                                {t.settings.language}:
                            </label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as Language)}
                                className="flex-auto rounded-2xl border border-gray-300 px-4 py-3 outline-none"
                            >
                                <option value="de">{t.settings.german}</option>
                                <option value="en">{t.settings.english}</option>
                            </select>
                        </div>

                        <div className="flex flex-row gap-3">
                            <label className="block py-3 text-sm font-medium">
                                {t.settings.currency}:
                            </label>
                            <select
                                value={currencySystem}
                                onChange={(e) => setCurrencySystem(e.target.value as CurrencySystem)}
                                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none overflow-auto"
                            >
                                {(fxCurrencies ?? { EUR: "Euro", USD: "US Dollar" }) &&
                                    Object.entries(fxCurrencies ?? { EUR: "Euro", USD: "US Dollar" })
                                        .sort((a, b) => a[0].localeCompare(b[0]))
                                        .map(([code, name]) => (
                                            <option key={code} value={code}>
                                                {code} - {name}
                                            </option>
                                        ))}
                            </select>
                        </div>

                        <div className="flex flex-row gap-3">
                            <label className="block py-3 text-sm font-medium">
                                {t.settings.measurement}:
                            </label>
                            <select
                                value={measurementSystem}
                                onChange={(e) =>
                                    setMeasurementSystem(e.target.value as MeasurementSystem)
                                }
                                className="flex-auto rounded-2xl border border-gray-300 px-4 py-3 outline-none"
                            >
                                <option value="metric">{t.settings.metric}</option>
                                <option value="imperial">{t.settings.imperial}</option>
                            </select>
                        </div>

                        <div className="flex flex-row gap-3">
                            <label className="block py-3 text-sm font-medium">
                                {t.pricing.fuelType}:
                            </label>
                            <select
                                value={fuelType}
                                onChange={(e) => setFuelType(e.target.value as FuelType)}
                                className="flex-auto rounded-2xl border border-gray-300 px-4 py-3 outline-none"
                            >
                                <option value="diesel">{t.pricing.diesel}</option>
                                <option value="super95">{t.pricing.super95}</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                                {t.settings.version}
                            </div>
                            <div className="font-mono text-xs text-gray-700">
                                {appVersion}
                            </div>
                        </div>

                        {showDebugControls ? (
                            <div className="mt-2 space-y-2 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                <label className="flex items-center justify-between gap-4">
                                    <span className="text-sm font-semibold text-gray-900">
                                        {t.settings.enableDebugMode}
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={debugMode}
                                        onChange={(e) => setDebugMode(e.target.checked)}
                                        className="h-5 w-5 accent-gray-900"
                                    />
                                </label>

                                {debugMode ? (
                                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                        <div className="text-sm font-semibold text-gray-900">
                                            {t.settings.logoCache}
                                        </div>
                                        <div className="mt-1 text-xs text-gray-600">
                                            {cacheStatus === "ok"
                                                ? t.settings.cacheCleared
                                                : cacheStatus === "error"
                                                    ? t.settings.cacheClearFailed
                                                    : " "}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleClearLogoCache}
                                            disabled={cacheClearing}
                                            className="mt-3 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
                                        >
                                            {cacheClearing
                                                ? t.settings.clearing
                                                : t.settings.clearLogoCache}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </section>

                    <section className="space-y-4">
                        <div>
                            <h3 className="text-lg font-bold">{t.vehicle.title}</h3>
                            <p className="mt-1 text-sm text-gray-600">
                                {t.vehicle.description}
                            </p>
                        </div>

                        <SliderNumberField
                            label={t.vehicle.consumption}
                            min={measurementSystem === "metric" ? 1.5 : 5}
                            max={measurementSystem === "metric" ? 40 : 150}
                            step={0.1}
                            value={consumption}
                            onChange={setConsumption}
                            unit={
                                measurementSystem === "metric"
                                    ? t.units.litersPer100Km
                                    : t.units.mpg
                            }
                        />

                        <SliderNumberField
                            label={t.vehicle.tankSize}
                            min={measurementSystem === "metric" ? 5 : 1.5}
                            max={measurementSystem === "metric" ? 800 : 210}
                            step={1}
                            value={tankSize}
                            onChange={setTankSize}
                            unit={
                                measurementSystem === "metric"
                                    ? t.units.liters
                                    : t.units.gallons
                            }
                        />

                        <SliderNumberField
                            label={t.vehicle.avgSpeed}
                            min={measurementSystem === "metric" ? 10 : 6}
                            max={measurementSystem === "metric" ? 180 : 110}
                            step={1}
                            value={avgSpeed}
                            onChange={setAvgSpeed}
                            unit={measurementSystem === "metric" ? t.units.kmh : t.units.mph}
                        />
                    </section>
                </div>
            </div>
        </div>
    );
}
