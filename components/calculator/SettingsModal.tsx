"use client";

import { useEffect, useState } from "react";
import { TranslationSchema } from "@/config/i18n";
import { FuelType, Language } from "@/types/tankify";
import SliderNumberField from "@/components/ui/SliderNumberField";

type Props = {
    open: boolean;
    onClose: () => void;
    t: TranslationSchema;
    language: Language;
    setLanguage: (language: Language) => void;
    fuelType: FuelType;
    setFuelType: (value: FuelType) => void;
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
                                          consumption,
                                          setConsumption,
                                          tankSize,
                                          setTankSize,
                                          avgSpeed,
                                          setAvgSpeed,
                                      }: Props) {
    const [mounted, setMounted] = useState(open);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (open) {
            setMounted(true);

            const frame = window.requestAnimationFrame(() => {
                setVisible(true);
            });

            return () => window.cancelAnimationFrame(frame);
        }

        setVisible(false);

        const timeout = window.setTimeout(() => {
            setMounted(false);
        }, 220);

        return () => window.clearTimeout(timeout);
    }, [open]);

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
            if (e.key === "Escape") {
                onClose();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!mounted) return null;

    return (
        <div
            className="fixed inset-0 z-2000 flex items-center justify-center p-4"
            aria-hidden={!open}
        >
            <button
                type="button"
                aria-label="Close settings overlay"
                className={`absolute inset-0 transition duration-200 ${
                    visible ? "bg-black/25 backdrop-blur-sm" : "bg-black/0 backdrop-blur-none"
                }`}
                onClick={onClose}
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-label={t.settings.title}
                onClick={(e) => e.stopPropagation()}
                className={`relative z-2001 max-h-[90dvh] w-[92vw] max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl transition duration-200 sm:p-8 ${
                    visible
                        ? "scale-100 opacity-100"
                        : "scale-95 opacity-0"
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

                        <div className="flex h-auto flex-row gap-3">
                            <label className="w-auto block py-3 text-sm font-medium">
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

                        <div className="flex h-auto flex-row gap-3">
                            <label className="w-auto block py-3 text-sm font-medium">
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
                            min={3}
                            max={25}
                            step={0.1}
                            value={consumption}
                            onChange={setConsumption}
                            unit="L / 100 km"
                        />

                        <SliderNumberField
                            label={t.vehicle.tankSize}
                            min={20}
                            max={120}
                            step={1}
                            value={tankSize}
                            onChange={setTankSize}
                            unit="L"
                        />

                        <SliderNumberField
                            label={t.vehicle.avgSpeed}
                            min={30}
                            max={130}
                            step={1}
                            value={avgSpeed}
                            onChange={setAvgSpeed}
                            unit="km/h"
                        />
                    </section>
                </div>
            </div>
        </div>
    );
}