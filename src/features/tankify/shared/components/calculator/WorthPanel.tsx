import { TranslationSchema } from "@/features/tankify/shared/config/i18n";
import { CurrencySystem } from "@/features/tankify/shared/types/tankify";
import { formatCurrency } from "@/features/tankify/shared/lib/format";
import { eurToQuote } from "@/features/tankify/shared/lib/fx";

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
    profit: ProfitLevel;
    netSavingEur: number;
};

export default function WorthPanel({
    t,
    currencySystem,
    eurToCurrencyRate,
    profit,
    netSavingEur,
}: Props) {
    const netSaving = eurToQuote(netSavingEur, eurToCurrencyRate);

    return (
        <div className="flex flex-col lg:flex-row gap-4">
            <div className={`rounded-3xl p-6 shadow-sm ${profit.bgClass}`}>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t.result.worthTrip}</span>
                    <span className={`text-sm font-semibold ${profit.colorClass}`}>
                        {t.profit[profit.labelKey]}
                    </span>
                </div>

                <div className={`mt-2 text-4xl font-bold ${profit.colorClass}`}>
                    {formatCurrency(netSaving, currencySystem)}
                </div>

                <p className="mt-2 text-sm text-gray-600">{t.result.netSavingAfterTrip}</p>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm flex-auto">
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
                        aria-hidden="true"
                    >
                        ▲
                    </div>
                </div>

                <p className="text-sm text-gray-600">{t.result.estimateHint}</p>
            </div>
        </div>
    );
}

