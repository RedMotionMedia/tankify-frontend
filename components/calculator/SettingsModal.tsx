"use client";

import { useEffect } from "react";
import { TranslationSchema } from "@/config/i18n";
import {
    CurrencySystem,
    FuelType,
    Language,
    MeasurementSystem,
} from "@/types/tankify";
import SliderNumberField from "@/components/ui/SliderNumberField";

type Props = {
    open: boolean;
    onClose: () => void;
    t: TranslationSchema;
    language: Language;
    setLanguage: (language: Language) => void;
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

    return (
        <div
            className={`fixed inset-0 z-2000 flex items-center justify-center p-4 transition duration-200 ${
                open ? "pointer-events-auto" : "pointer-events-none"
            }`}
            aria-hidden={!open}
        >
            <button
                type="button"
                aria-label="Close settings overlay"
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
                className={`relative z-2001 max-h-[90dvh] w-[92vw] max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl transition duration-200 sm:p-8 ${
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
                        aria-label="Close settings"
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
                                className="flex-auto rounded-2xl border border-gray-300 px-4 py-3 outline-none"
                            >
                                <option value="eur">{t.settings.currencyEuro}</option>
                                <option value="usd">{t.settings.currencyDollar}</option>
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

                    <section className="space-y-4">
                        <div>
                            <h3 className="text-lg font-bold">{t.vehicle.title}</h3>
                            <p className="mt-1 text-sm text-gray-600">
                                {t.vehicle.description}
                            </p>
                        </div>

                        <SliderNumberField
                            label={t.vehicle.consumption}
                            min={measurementSystem === "metric" ? 3 : 5}
                            max={measurementSystem === "metric" ? 25 : 80}
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
                            min={measurementSystem === "metric" ? 20 : 5}
                            max={measurementSystem === "metric" ? 120 : 35}
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
                            min={measurementSystem === "metric" ? 30 : 20}
                            max={measurementSystem === "metric" ? 130 : 80}
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