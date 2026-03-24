import {TranslationSchema} from "@/config/i18n";
import {CurrencySystem, MeasurementSystem} from "@/types/tankify";
import {formatCurrency, formatDuration} from "@/lib/format";
import StatCard from "@/components/ui/StatCard";
import {TankifyCalculation} from "@/lib/calc";

type ProfitLevel = {
    labelKey: "notWorthIt" | "barelyWorthIt" | "worthIt" | "veryWorthIt";
    colorClass: string;
    bgClass: string;
    percent: number;
};

type Props = {
    t: TranslationSchema;
    currencySystem: CurrencySystem;
    measurementSystem: MeasurementSystem;
    profit: ProfitLevel;
    routeLoading: boolean;
    calculation: TankifyCalculation;
};

export default function ResultsPanel({
                                         t,
                                         currencySystem,
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

    const priceDifferenceValue =
        measurementSystem === "metric"
            ? {
                value: calculation.priceDifferencePerLiter,
                unit:
                    currencySystem === "eur"
                        ? "€/L"
                        : "$/L",
            }
            : {
                value: calculation.priceDifferencePerGallon,
                unit:
                    currencySystem === "eur"
                        ? "€/gal"
                        : "$/gal",
            };

    const breakEvenValue =
        measurementSystem === "metric"
            ? {
                value: calculation.breakEvenDiffPerLiter * 100,
                unit: t.units.centPerLiter,
            }
            : {
                value: calculation.breakEvenDiffPerGallon * 100,
                unit: t.units.centPerGallon,
            };

    const maxConsumptionValue =
        measurementSystem === "metric"
            ? {
                value: calculation.maxConsumptionLPer100Km,
                unit: t.units.litersPer100Km,
            }
            : {
                value: calculation.maxConsumptionMpg,
                unit: t.units.mpg,
            };

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
                        value={`${priceDifferenceValue.value.toFixed(3)} ${priceDifferenceValue.unit}`}
                    />
                    <StatCard
                        title={t.result.tripCost}
                        value={formatCurrency(calculation.tripCost, currencySystem)}
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
                        value={formatCurrency(calculation.grossSavingFullTank, currencySystem)}
                    />
                    <StatCard
                        title={t.result.netSaving}
                        value={formatCurrency(calculation.netSaving, currencySystem)}
                        valueClassName={profit.colorClass}
                    />
                </div>
            </div>

            <div>
                <h2 className="mb-3 text-xl font-bold">{t.result.details}</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                    <StatCard
                        title={t.pricing.breakEvenDiff}
                        value={`${breakEvenValue.value.toFixed(1)} ${breakEvenValue.unit}`}
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