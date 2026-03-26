import { TranslationSchema } from "@/config/i18n";
import { CurrencySystem, MeasurementSystem } from "@/types/tankify";
import ResultsPanel from "./ResultsPanel";
import WorthPanel from "@/components/calculator/WorthPanel";
import { TankifyCalculation } from "@/lib/calc";

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
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMoveHandle: (e: React.TouchEvent) => void;
    onTouchMoveContent: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    controls: React.ReactNode;
    routeLoading: boolean;
    showResults: boolean;
    calculation: TankifyCalculation;
    profit: ProfitLevel;
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
                                              onTouchStart,
                                              onTouchMoveHandle,
                                              onTouchMoveContent,
                                              onTouchEnd,
                                              controls,
                                              routeLoading,
                                              showResults,
                                              calculation,
                                              profit,
                                          }: Props) {
    return (
        <div
            className="fixed inset-x-0 bottom-0 z-10"
            style={{
                transform: `translateY(${sheetY}px)`,
                transition: !isSheetReady || dragging ? "none" : "transform 0.25s ease",
            }}
        >
            <div
                ref={sheetContentRef}
                className="mobile-sheet w-screen rounded-t-[28px] bg-white pb-10 shadow-2xl"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMoveContent}
                onTouchEnd={onTouchEnd}
            >
                <div
                    className="sheet-handle w-screen px-4 pt-3"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMoveHandle}
                    onTouchEnd={onTouchEnd}
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

                <div className="mt-6 space-y-6 px-4">
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
        </div>
    );
}
