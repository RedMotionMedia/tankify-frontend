import { TranslationSchema } from "@/config/i18n";
import { CurrencySystem, MeasurementSystem } from "@/types/tankify";
import { formatCurrency, formatDuration } from "@/lib/format";
import StatCard from "@/components/ui/StatCard";
import { TankifyCalculation } from "@/lib/calc";
import { eurToQuote } from "@/lib/fx";

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
    profit: ProfitLevel;
    routeLoading: boolean;
    calculation: TankifyCalculation;
};

export default function ResultsPanel({
    t,
    currencySystem,
    eurToCurrencyRate,
    measurementSystem,
    profit,
    routeLoading,
    calculation,
}: Props) {
    const distanceValue =
        measurementSystem === "metric"
            ? {
                  oneWay: calculation.oneWayDistanceKm,
                  roundTrip: calculation.roundTripDistanceKm,
                  unit: t.units.km,
              }
            : {
                  oneWay: calculation.oneWayDistanceMiles,
                  roundTrip: calculation.roundTripDistanceMiles,
                  unit: t.units.miles,
              };

    const unit = measurementSystem === "metric" ? "/L" : "/gal";

    const priceDiff =
        measurementSystem === "metric"
            ? eurToQuote(calculation.priceDifferencePerLiter, eurToCurrencyRate)
            : eurToQuote(calculation.priceDifferencePerGallon, eurToCurrencyRate);

    const breakEven =
        measurementSystem === "metric"
            ? eurToQuote(calculation.breakEvenDiffPerLiter, eurToCurrencyRate) * 100
            : eurToQuote(calculation.breakEvenDiffPerGallon, eurToCurrencyRate) * 100;
    const breakEvenUnit =
        measurementSystem === "metric" ? t.units.centPerLiter : t.units.centPerGallon;

    const maxConsumptionValue =
        measurementSystem === "metric"
            ? { value: calculation.maxConsumptionLPer100Km, unit: t.units.litersPer100Km }
            : { value: calculation.maxConsumptionMpg, unit: t.units.mpg };

    const tripCost = eurToQuote(calculation.tripCost, eurToCurrencyRate);
    const grossSavingFullTank = eurToQuote(calculation.grossSavingFullTank, eurToCurrencyRate);
    const netSaving = eurToQuote(calculation.netSaving, eurToCurrencyRate);

    return (
        <section className="space-y-6">
            <div>
                <h2 className="mb-3 text-xl font-bold">{t.result.importantMetrics}</h2>
                <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        title={t.result.oneWayDistance}
                        value={
                            routeLoading
                                ? t.status.loading
                                : `${distanceValue.oneWay.toFixed(1)} ${distanceValue.unit}`
                        }
                    />
                    <StatCard
                        title={t.result.roundTripDistance}
                        value={
                            routeLoading
                                ? t.status.loading
                                : `${distanceValue.roundTrip.toFixed(1)} ${distanceValue.unit}`
                        }
                    />
                    <StatCard
                        title={t.pricing.priceDifference}
                        value={`${priceDiff.toFixed(3)} ${currencySystem}${unit}`}
                    />
                    <StatCard
                        title={t.result.tripCost}
                        value={formatCurrency(tripCost, currencySystem)}
                    />
                    <StatCard
                        title={t.result.oneWayDuration}
                        value={
                            routeLoading
                                ? t.status.loading
                                : formatDuration(calculation.estimatedHoursOneWay)
                        }
                    />
                    <StatCard
                        title={t.result.totalDuration}
                        value={
                            routeLoading
                                ? t.status.loading
                                : formatDuration(calculation.estimatedHoursRoundTrip)
                        }
                    />
                    <StatCard
                        title={t.result.fullTankSaving}
                        value={formatCurrency(grossSavingFullTank, currencySystem)}
                    />
                    <StatCard
                        title={t.result.netSaving}
                        value={formatCurrency(netSaving, currencySystem)}
                        valueClassName={profit.colorClass}
                    />
                </div>
            </div>

            <div>
                <h2 className="mb-3 text-xl font-bold">{t.result.details}</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                    <StatCard
                        title={t.pricing.breakEvenDiff}
                        value={`${breakEven.toFixed(1)} ${breakEvenUnit}`}
                    />
                    <StatCard
                        title={t.vehicle.maxConsumption}
                        value={`${maxConsumptionValue.value.toFixed(1)} ${maxConsumptionValue.unit}`}
                    />
                </div>
            </div>
        </section>
    );
}
