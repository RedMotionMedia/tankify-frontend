"use client";

import { useEffect } from "react";
import { TranslationSchema } from "@/config/i18n";
import { MeasurementSystem } from "@/types/tankify";
import VehicleSection from "@/components/calculator/VehicleSection";

type Props = {
    open: boolean;
    t: TranslationSchema;
    measurementSystem: MeasurementSystem;
    consumption: number;
    setConsumption: (value: number) => void;
    tankSize: number;
    setTankSize: (value: number) => void;
    avgSpeed: number;
    setAvgSpeed: (value: number) => void;
    onConfirm: () => void;
};

export default function VehicleModal({
    open,
    t,
    measurementSystem,
    consumption,
    setConsumption,
    tankSize,
    setTankSize,
    avgSpeed,
    setAvgSpeed,
    onConfirm,
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

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
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

                <div className="mt-6 flex justify-end">
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

