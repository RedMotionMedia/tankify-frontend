"use client";

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
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center">
            <button
                type="button"
                aria-label="Close settings overlay"
                className="absolute inset-0 bg-black/25 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative z-[2001] w-[92vw] max-w-2xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
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
                        className="rounded-full px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
                    >
                        ✕
                    </button>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                    <section className="space-y-4">
                        <div>
                            <h3 className="text-lg font-bold">{t.settings.title}</h3>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                {t.settings.language}
                            </label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as Language)}
                                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none"
                            >
                                <option value="de">{t.settings.german}</option>
                                <option value="en">{t.settings.english}</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                {t.pricing.fuelType}
                            </label>
                            <select
                                value={fuelType}
                                onChange={(e) => setFuelType(e.target.value as FuelType)}
                                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none"
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