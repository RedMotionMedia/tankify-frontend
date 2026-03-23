import { TranslationSchema } from "@/config/i18n";
import { Language } from "@/types/tankify";
import { formatCurrency } from "@/lib/format";

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
    netSaving: number;
};

export default function WorthPanel({
                                       t,
                                       language,
                                       profit,
                                       netSaving,
                                   }: Props) {
    return (
        <div className="space-y-6">
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
        </div>
    );
}