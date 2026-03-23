import {TranslationSchema} from "@/config/i18n";
import {Language} from "@/types/tankify";
import ResultsPanel from "./ResultsPanel";
import WorthPanel from "@/components/calculator/WorthPanel";

type ProfitLevel = {
    labelKey: "notWorthIt" | "barelyWorthIt" | "worthIt" | "veryWorthIt";
    colorClass: string;
    bgClass: string;
    percent: number;
};

type Props = {
    t: TranslationSchema;
    language: Language;
    sheetContentRef: React.RefObject<HTMLDivElement | null>;
    sheetY: number;
    dragging: boolean;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMoveHandle: (e: React.TouchEvent) => void;
    onTouchMoveContent: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    controls: React.ReactNode;
    routeLoading: boolean;
    oneWayKm: number;
    roundTripKm: number;
    priceDifference: number;
    tripCost: number;
    estimatedHoursOneWay: number;
    estimatedHoursRoundTrip: number;
    grossSavingFullTank: number;
    netSaving: number;
    breakEvenDiff: number;
    maxConsumption: number;
    profit: ProfitLevel;
    isSheetReady: boolean;
};

export default function MobileBottomSheet({
                                              t,
                                              language,
                                              sheetContentRef,
                                              sheetY,
                                              dragging,
                                              onTouchStart,
                                              onTouchMoveHandle,
                                              onTouchMoveContent,
                                              onTouchEnd,
                                              controls,
                                              routeLoading,
                                              oneWayKm,
                                              roundTripKm,
                                              priceDifference,
                                              tripCost,
                                              estimatedHoursOneWay,
                                              estimatedHoursRoundTrip,
                                              grossSavingFullTank,
                                              netSaving,
                                              breakEvenDiff,
                                              maxConsumption,
                                              profit,
                                              isSheetReady
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
                    <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300"/>

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

                    <WorthPanel
                        t={t}
                        language={language}
                        profit={profit}
                        netSaving={netSaving}/>

                    <div>
                        <h3 className="mb-3 text-lg font-bold">{t.app.adjustCalculator}</h3>
                        {controls}
                    </div>

                    <ResultsPanel
                        t={t}
                        language={language}
                        profit={profit}
                        routeLoading={routeLoading}
                        oneWayKm={oneWayKm}
                        roundTripKm={roundTripKm}
                        priceDifference={priceDifference}
                        tripCost={tripCost}
                        estimatedHoursOneWay={estimatedHoursOneWay}
                        estimatedHoursRoundTrip={estimatedHoursRoundTrip}
                        grossSavingFullTank={grossSavingFullTank}
                        netSaving={netSaving}
                        breakEvenDiff={breakEvenDiff}
                        maxConsumption={maxConsumption}
                    />


                </div>
            </div>
        </div>
    )
        ;
}