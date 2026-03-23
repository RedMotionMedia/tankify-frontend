import { TranslationSchema } from "@/config/i18n";
import { Language } from "@/types/tankify";
import { formatCurrency, formatDuration } from "@/lib/format";
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
            <div className={`rounded-3xl p-6 shadow-sm ${profit.bgClass}`}>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t.result.worthTrip}</span>
                    <span className={`text-sm font-semibold ${profit.colorClass}`}>
            {t.profit[profit.labelKey]}
          </span>
                </div>

                <div className={`mt-2 text-4xl font-bold ${profit.colorClass}`}>
                    {formatCurrency(netSaving, language)}
                </div>

                <p className="mt-2 text-sm text-gray-600">
                    {t.result.netSavingAfterTrip}
                </p>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t.result.estimate}</span>
                    <span className={`text-sm font-semibold ${profit.colorClass}`}>
            {t.profit[profit.labelKey]}
          </span>
                </div>

                <div className="relative pt-2 pb-8">
                    <div className="h-4 rounded-full bg-linear-to-r from-red-500 via-yellow-400 to-green-500" />
                    <div
                        className="absolute bottom-0 -translate-x-1/2 text-lg leading-none"
                        style={{ left: `${profit.percent}%` }}
                    >
                        ▲
                    </div>
                </div>

                <p className="text-sm text-gray-600">{t.result.estimateHint}</p>
            </div>

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