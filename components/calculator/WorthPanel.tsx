import { TranslationSchema } from "@/config/i18n";
import { CurrencySystem } from "@/types/tankify";
import { formatCurrency } from "@/lib/format";

type ProfitLevel = {
    labelKey: "notWorthIt" | "barelyWorthIt" | "worthIt" | "veryWorthIt";
    colorClass: string;
    bgClass: string;
    percent: number;
};

type Props = {
    t: TranslationSchema;
    currencySystem: CurrencySystem;
    profit: ProfitLevel;
    netSaving: number;
};

export default function WorthPanel({
                                       t,
                                       currencySystem,
                                       profit,
                                       netSaving,
                                   }: Props) {
    return (
        <div className="flex flex-row gap-4">
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

                <p className="mt-2 text-sm text-gray-600">
                    {t.result.netSavingAfterTrip}
                </p>
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
                    >
                        ▲
                    </div>
                </div>

                <p className="text-sm text-gray-600">{t.result.estimateHint}</p>
            </div>
        </div>
    );
}