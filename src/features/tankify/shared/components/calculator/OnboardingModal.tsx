"use client";

import { useEffect, useState } from "react";
import { TranslationSchema } from "@/features/tankify/shared/config/i18n";
import { CurrencySystem, FuelType, Language, MeasurementSystem } from "@/features/tankify/shared/types/tankify";
import VehicleSection from "./VehicleSection";

type Props = {
    open: boolean;
    t: TranslationSchema;
    language: Language;
    setLanguage: (language: Language) => void;
    currencySystem: CurrencySystem;
    setCurrencySystem: (value: CurrencySystem) => void;
    measurementSystem: MeasurementSystem;
    setMeasurementSystem: (value: MeasurementSystem) => void;
    fuelType: FuelType;
    setFuelType: (value: FuelType) => void;
    consumption: number;
    setConsumption: (value: number) => void;
    tankSize: number;
    setTankSize: (value: number) => void;
    avgSpeed: number;
    setAvgSpeed: (value: number) => void;
    onConfirm: () => void;
};

export default function OnboardingModal({
    open,
    t,
    language,
    setLanguage,
    currencySystem,
    setCurrencySystem,
    measurementSystem,
    setMeasurementSystem,
    fuelType,
    setFuelType,
    consumption,
    setConsumption,
    tankSize,
    setTankSize,
    avgSpeed,
    setAvgSpeed,
    onConfirm,
}: Props) {
    const [fxCurrencies, setFxCurrencies] = useState<Record<string, string> | null>(null);

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

    if (!open) return null;

    const currencyOptions = fxCurrencies ?? { EUR: "Euro", USD: "US Dollar" };

    return (
        <div className="fixed inset-0 z-[3200] grid place-items-center bg-black/40 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-label={t.onboarding.title}
                className="max-h-[90dvh] w-[92vw] max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
            >
                <div className="mb-6">
                    <h2 className="text-2xl font-bold">{t.onboarding.title}</h2>
                    <p className="mt-1 text-sm text-gray-600">{t.onboarding.note}</p>
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
                                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none"
                            >
                                {Object.entries(currencyOptions)
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
                    </section>

                    <div>
                        <VehicleSection
                            t={t}
                            measurementSystem={measurementSystem}
                            consumption={consumption}
                            setConsumption={setConsumption}
                            tankSize={tankSize}
                            setTankSize={setTankSize}
                            avgSpeed={avgSpeed}
                            setAvgSpeed={setAvgSpeed}
                        />
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition active:scale-95 hover:opacity-90"
                    >
                        {t.actions.confirm}
                    </button>
                </div>
            </div>
        </div>
    );
}

