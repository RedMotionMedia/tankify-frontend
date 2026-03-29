import { TranslationSchema } from "@/features/tankify/shared/config/i18n";
import { CurrencySystem, MeasurementSystem } from "@/features/tankify/shared/types/tankify";
import SliderNumberField from "../ui/SliderNumberField";
import { eurToQuote } from "@/features/tankify/shared/lib/fx";

type Props = {
    t: TranslationSchema;
    localPrice: number;
    setLocalPrice: (value: number) => void;
    destinationPrice: number;
    setDestinationPrice: (value: number) => void;
    currencySystem: CurrencySystem;
    eurToCurrencyRate: number;
    measurementSystem: MeasurementSystem;
};

export default function PriceSection({
    t,
    localPrice,
    setLocalPrice,
    destinationPrice,
    setDestinationPrice,
    currencySystem,
    eurToCurrencyRate,
    measurementSystem,
}: Props) {
    const unit = measurementSystem === "metric" ? `${currencySystem}/L` : `${currencySystem}/gal`;
    const min = eurToQuote(0.2, eurToCurrencyRate);
    const max = eurToQuote(5.0, eurToCurrencyRate);

    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-bold">{t.pricing.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{t.pricing.description}</p>
            </div>

            <SliderNumberField
                label={t.pricing.localPrice}
                min={min}
                max={max}
                step={0.001}
                value={localPrice}
                onChange={setLocalPrice}
                unit={unit}
            />

            <SliderNumberField
                label={t.pricing.destinationPrice}
                min={min}
                max={max}
                step={0.001}
                value={destinationPrice}
                onChange={setDestinationPrice}
                unit={unit}
            />
        </section>
    );
}
