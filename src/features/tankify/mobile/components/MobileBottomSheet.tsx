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
import MobileStationsSidebar from "@/features/tankify/mobile/components/MobileStationsSidebar";

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
    page?: 0 | 1;
    onPageChange?: (page: 0 | 1) => void;
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
                                              page: controlledPage,
                                              onPageChange,
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
    const calcScrollRef = useRef<HTMLDivElement | null>(null);
    const stationsScrollRef = useRef<HTMLDivElement | null>(null);
    const carouselSwipeRef = useRef<{
        active: boolean;
        axis: "undecided" | "horizontal" | "vertical";
        startX: number;
        startY: number;
        startScrollLeft: number;
        startIndex: 0 | 1;
        startTimeMs: number;
        lastX: number;
        lastTimeMs: number;
    }>({
        active: false,
        axis: "undecided",
        startX: 0,
        startY: 0,
        startScrollLeft: 0,
        startIndex: 0,
        startTimeMs: 0,
        lastX: 0,
        lastTimeMs: 0,
    });
    const [uncontrolledPage, setUncontrolledPage] = useState<0 | 1>(0);
    const page = controlledPage ?? uncontrolledPage;
    const setPage = onPageChange ?? setUncontrolledPage;

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

    useEffect(() => {
        if (controlledPage == null) return;
        const el = carouselRef.current;
        if (!el) return;
        const w = el.clientWidth || 1;
        const desiredLeft = page * w;
        if (Math.abs(el.scrollLeft - desiredLeft) <= 2) return;
        el.scrollTo({ left: desiredLeft, behavior: "smooth" });
    }, [controlledPage, page]);

    useEffect(() => {
        // Tell the BottomSheet hook which element is currently the active vertical scroll container.
        sheetContentRef.current = page === 0 ? calcScrollRef.current : stationsScrollRef.current;
    }, [page, sheetContentRef]);

    function onCarouselTouchStart(e: React.TouchEvent) {
        const target = e.target as HTMLElement | null;
        if (target?.closest("input, textarea, select, [data-no-carousel-swipe]")) return;

        const el = carouselRef.current;
        if (!el) return;

        const t0 = e.touches[0];
        const now = performance.now();
        const w = el.clientWidth || 1;
        const startIndex = Math.max(0, Math.min(1, Math.round(el.scrollLeft / w))) as 0 | 1;
        carouselSwipeRef.current.active = true;
        carouselSwipeRef.current.axis = "undecided";
        carouselSwipeRef.current.startX = t0.clientX;
        carouselSwipeRef.current.startY = t0.clientY;
        carouselSwipeRef.current.startScrollLeft = el.scrollLeft;
        carouselSwipeRef.current.startIndex = startIndex;
        carouselSwipeRef.current.startTimeMs = now;
        carouselSwipeRef.current.lastX = t0.clientX;
        carouselSwipeRef.current.lastTimeMs = now;
    }

    function onCarouselTouchMove(e: React.TouchEvent) {
        const state = carouselSwipeRef.current;
        if (!state.active) return;

        const el = carouselRef.current;
        if (!el) return;

        const t0 = e.touches[0];
        const dx = t0.clientX - state.startX;
        const dy = t0.clientY - state.startY;
        state.lastX = t0.clientX;
        state.lastTimeMs = performance.now();

        if (state.axis === "undecided") {
            const threshold = 6;
            const adx = Math.abs(dx);
            const ady = Math.abs(dy);
            if (adx < threshold && ady < threshold) return;
            state.axis = adx > ady ? "horizontal" : "vertical";

            if (state.axis === "vertical") {
                // Let the page-specific scroll container handle it.
                state.active = false;
                state.axis = "undecided";
                return;
            }
        }

        if (state.axis === "horizontal") {
            // Manual horizontal scroll to make swipe reliable even inside nested vertical scrollers.
            e.preventDefault();
            el.scrollLeft = state.startScrollLeft - dx;
        }
    }

    function onCarouselTouchEnd() {
        const state = carouselSwipeRef.current;
        const el = carouselRef.current;
        if (state.active && state.axis === "horizontal" && el) {
            const w = el.clientWidth || 1;

            const dxTotal = state.lastX - state.startX;
            const dt = Math.max(1, state.lastTimeMs - state.startTimeMs);
            const v = Math.abs(dxTotal) / dt; // px/ms

            // Make swipe easier: a short flick should switch pages without needing half-screen travel.
            const minSwipePx = 34;
            const minFlickVelocity = 0.65; // ~650px/s

            let idx: 0 | 1;
            if (Math.abs(dxTotal) >= minSwipePx || v >= minFlickVelocity) {
                const dir = dxTotal < 0 ? 1 : -1; // finger left => next page, finger right => prev page
                idx = Math.max(0, Math.min(1, state.startIndex + dir)) as 0 | 1;
            } else {
                idx = Math.max(0, Math.min(1, Math.round(el.scrollLeft / w))) as 0 | 1;
            }

            el.scrollTo({ left: idx * w, behavior: "smooth" });
            setPage(idx);
        }
        carouselSwipeRef.current.active = false;
        carouselSwipeRef.current.axis = "undecided";
    }

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

                    <p className="text-center text-xs text-gray-600">
                        {t.app.mobileSubtitle}
                    </p>
                </div>

                {/* Keep the toggle bar outside the scrollable area so scrolling/swiping starts below it. */}
                <div className="w-screen shrink-0 px-3 py-2" data-no-sheet-drag>
                    <div className=" flex items-center justify-between gap-3">
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
                    className="flex-1 overflow-hidden"
                    onTouchStartCapture={onTouchStartContent}
                >
                    <div
                        ref={carouselRef}
                        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
                        style={{ WebkitOverflowScrolling: "touch" }}
                        onTouchStartCapture={onCarouselTouchStart}
                        onTouchMoveCapture={onCarouselTouchMove}
                        onTouchEndCapture={onCarouselTouchEnd}
                        onTouchCancelCapture={onCarouselTouchEnd}
                    >
                        <div
                            ref={calcScrollRef}
                            className="h-full w-full shrink-0 snap-start overflow-y-auto overscroll-contain px-3"
                        >
                            <div className="space-y-6 pb-10">
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

                        <div className="h-full w-full shrink-0 snap-start overflow-hidden">
                            <div className="flex h-full min-h-0 w-full flex-col px-3">
                                <MobileStationsSidebar
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
                                    scrollContainerRef={stationsScrollRef}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
