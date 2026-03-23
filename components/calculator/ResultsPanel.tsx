import {TranslationSchema} from "@/config/i18n";
import {Language} from "@/types/tankify";
import {formatCurrency, formatDuration} from "@/lib/format";
import StatCard from "@/components/ui/StatCard";

type ProfitLevel = {
    labelKey: "notWorthIt" | "barelyWorthIt" | "worthIt" | "veryWorthIt";
    colorClass: string;
    bgClass: string;
    percent: number;
};

type Props = {
    t: TranslationSchema;
    language: Language;
    profit: ProfitLevel;
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
};

export default function ResultsPanel({
                                         t,
                                         language,
                                         profit,
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
                                     }: Props) {
    return (
        <section className="space-y-6">
            <div>
                <h2 className="mb-3 text-xl font-bold">{t.result.importantMetrics}</h2>
                <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        title={t.result.oneWayDistance}
                        value={routeLoading ? t.status.loading : `${oneWayKm.toFixed(1)} km`}
                    />
                    <StatCard
                        title={t.result.roundTripDistance}
                        value={routeLoading ? t.status.loading : `${roundTripKm.toFixed(1)} km`}
                    />
                    <StatCard
                        title={t.pricing.priceDifference}
                        value={`${priceDifference.toFixed(3)} €/L`}
                    />
                    <StatCard
                        title={t.result.tripCost}
                        value={formatCurrency(tripCost, language)}
                    />
                    <StatCard
                        title={t.result.oneWayDuration}
                        value={
                            routeLoading
                                ? t.status.loading
                                : formatDuration(estimatedHoursOneWay, language)
                        }
                    />
                    <StatCard
                        title={t.result.totalDuration}
                        value={
                            routeLoading
                                ? t.status.loading
                                : formatDuration(estimatedHoursRoundTrip, language)
                        }
                    />
                    <StatCard
                        title={t.result.fullTankSaving}
                        value={formatCurrency(grossSavingFullTank, language)}
                    />
                    <StatCard
                        title={t.result.netSaving}
                        value={formatCurrency(netSaving, language)}
                        valueClassName={profit.colorClass}
                    />
                </div>
            </div>

            <div>
                <h2 className="mb-3 text-xl font-bold">{t.result.details}</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                    <StatCard
                        title={t.pricing.breakEvenDiff}
                        value={`${(breakEvenDiff * 100).toFixed(1)} Cent/L`}
                    />
                    <StatCard
                        title={t.vehicle.maxConsumption}
                        value={`${maxConsumption.toFixed(1)} L / 100 km`}
                    />
                </div>
            </div>
        </section>
    );
}