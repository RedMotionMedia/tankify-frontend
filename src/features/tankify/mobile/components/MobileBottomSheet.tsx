import { useEffect, useRef, useState } from "react";
import { TranslationSchema } from "@/features/tankify/shared/config/i18n";
import {
    CurrencySystem,
    FuelType,
    Language,
    MeasurementSystem,
    Point,
    Station,
} from "@/features/tankify/shared/types/tankify";
import ResultsPanel from "@/features/tankify/shared/components/calculator/ResultsPanel";
import WorthPanel from "@/features/tankify/shared/components/calculator/WorthPanel";
import { TankifyCalculation } from "@/features/tankify/shared/lib/calc";
import StationsSidebar from "@/features/tankify/desktop/components/StationsSidebar";

type ProfitLevel = {
    labelKey: "notWorthIt" | "barelyWorthIt" | "worthIt" | "veryWorthIt";
    colorClass: string;
    bgClass: string;
    percent: number;
};

type Props = {
    t: TranslationSchema;
    currencySystem: CurrencySystem;
    eurToCurrencyRate: number;
    measurementSystem: MeasurementSystem;
    sheetContentRef: React.RefObject<HTMLDivElement | null>;
    sheetY: number;
    dragging: boolean;
    isSheetReady: boolean;
    onTouchStartHandle: (e: React.TouchEvent) => void;
    onTouchStartContent: (e: React.TouchEvent) => void;
    onTouchMoveHandle: (e: React.TouchEvent) => void;
    onTouchMoveContent: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    controls: React.ReactNode;
    routeLoading: boolean;
    showResults: boolean;
    calculation: TankifyCalculation;
    profit: ProfitLevel;
    stations: Station[];
    selectedStationId: string | null;
    onToggleStation: (stationId: string) => void;
    fuelType: FuelType;
    language: Language;
    debugMode: boolean;
    userLocation: { lat: number; lon: number } | null;
    onSelectStationAsStart: (payload: { point: Point; price?: number | null; station: Station }) => void;
    onSelectStationAsDestination: (payload: {
        point: Point;
        price?: number | null;
        station: Station;
        autoCalculate?: boolean;
    }) => void;
};

export default function MobileBottomSheet({
                                              t,
                                              currencySystem,
                                              eurToCurrencyRate,
                                              measurementSystem,
                                              sheetContentRef,
                                              sheetY,
                                              dragging,
                                              isSheetReady,
                                              onTouchStartHandle,
                                              onTouchStartContent,
                                              onTouchMoveHandle,
                                              onTouchMoveContent,
                                              onTouchEnd,
                                              controls,
                                              routeLoading,
                                              showResults,
                                              calculation,
                                              profit,
                                              stations,
                                              selectedStationId,
                                              onToggleStation,
                                              fuelType,
                                              language,
                                              debugMode,
                                              userLocation,
                                              onSelectStationAsStart,
                                              onSelectStationAsDestination,
                                          }: Props) {
    const carouselRef = useRef<HTMLDivElement | null>(null);
    const [page, setPage] = useState<0 | 1>(0);

    useEffect(() => {
        const el = carouselRef.current;
        if (!el) return;
        const node = el;

        function onScroll() {
            const w = node.clientWidth || 1;
            const idx = node.scrollLeft > w * 0.5 ? 1 : 0;
            setPage(idx as 0 | 1);
        }

        onScroll();
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, []);

    function goTo(next: 0 | 1) {
        const el = carouselRef.current;
        if (!el) return;
        const w = el.clientWidth || 1;
        el.scrollTo({ left: next * w, behavior: "smooth" });
    }

    return (
        <div
            className="fixed inset-x-0 bottom-0 z-10"
            style={{
                transform: `translateY(${sheetY}px)`,
                transition: !isSheetReady || dragging ? "none" : "transform 0.25s ease",
            }}
            onTouchMoveCapture={onTouchMoveContent}
            onTouchEndCapture={onTouchEnd}
            onTouchCancelCapture={onTouchEnd}
        >
            <div
                className="mobile-sheet flex h-[100svh] w-screen flex-col rounded-t-[28px] bg-white shadow-2xl"
            >
                <div
                    data-sheet-handle
                    className="sheet-handle w-screen px-4 pt-3"
                    onTouchStartCapture={onTouchStartHandle}
                >
                    <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300" />

                    <p className="text-center text-sm font-medium text-gray-500">
                        {t.app.mobilePullUp}
                    </p>

                    <h2 className="mt-3 text-center text-2xl font-bold">
                        {t.app.mobileTitle}
                    </h2>

                    <p className="mt-2 text-center text-sm text-gray-600">
                        {t.app.mobileSubtitle}
                    </p>
                </div>

                {/* Keep the toggle bar outside the scrollable area so scrolling/swiping starts below it. */}
                <div className="w-screen shrink-0 px-4 pt-4" data-no-sheet-drag>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="inline-flex rounded-full bg-gray-100 p-1">
                            <button
                                type="button"
                                onClick={() => goTo(0)}
                                className={
                                    "rounded-full px-4 py-2 text-sm font-semibold transition " +
                                    (page === 0 ? "bg-white shadow-sm text-gray-900" : "text-gray-600")
                                }
                            >
                                Rechner
                            </button>
                            <button
                                type="button"
                                onClick={() => goTo(1)}
                                className={
                                    "rounded-full px-4 py-2 text-sm font-semibold transition " +
                                    (page === 1 ? "bg-white shadow-sm text-gray-900" : "text-gray-600")
                                }
                            >
                                Tankstellen
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <span
                                className={"h-2 w-2 rounded-full " + (page === 0 ? "bg-gray-900" : "bg-gray-300")}
                                aria-hidden="true"
                            />
                            <span
                                className={"h-2 w-2 rounded-full " + (page === 1 ? "bg-gray-900" : "bg-gray-300")}
                                aria-hidden="true"
                            />
                        </div>
                    </div>
                </div>

                <div
                    ref={sheetContentRef}
                    className="flex-1 overflow-y-auto overscroll-contain pb-10"
                    onTouchStartCapture={onTouchStartContent}
                >
                    <div className="px-4">
                    <div
                        ref={carouselRef}
                        className="flex w-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
                        style={{ WebkitOverflowScrolling: "touch" }}
                    >
                        <div className="w-full shrink-0 snap-start pr-4">
                            <div className="space-y-6">
                                {showResults ? (
                                    <WorthPanel
                                        t={t}
                                        currencySystem={currencySystem}
                                        eurToCurrencyRate={eurToCurrencyRate}
                                        profit={profit}
                                        netSavingEur={calculation.netSaving}
                                    />
                                ) : null}

                                <div>
                                    <h3 className="mb-3 text-lg font-bold">{t.app.adjustCalculator}</h3>
                                    {controls}
                                </div>

                                {showResults ? (
                                    <ResultsPanel
                                        t={t}
                                        currencySystem={currencySystem}
                                        eurToCurrencyRate={eurToCurrencyRate}
                                        measurementSystem={measurementSystem}
                                        profit={profit}
                                        routeLoading={routeLoading}
                                        calculation={calculation}
                                    />
                                ) : null}
                            </div>
                        </div>

                        <div className="w-full shrink-0 snap-start">
                            <div className="rounded-3xl border border-gray-200 bg-white p-3 shadow-sm">
                                <StationsSidebar
                                    stations={stations}
                                    selectedStationId={selectedStationId}
                                    onToggleStation={onToggleStation}
                                    fuelType={fuelType}
                                    measurementSystem={measurementSystem}
                                    currencySystem={currencySystem}
                                    eurToCurrencyRate={eurToCurrencyRate}
                                    language={language}
                                    debugMode={debugMode}
                                    userLocation={userLocation}
                                    t={t}
                                    onSelectStationAsStart={onSelectStationAsStart}
                                    onSelectStationAsDestination={onSelectStationAsDestination}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                </div>
            </div>
        </div>
    );
}
