import { TranslationSchema } from "@/config/i18n";
import { CurrencySystem, MeasurementSystem } from "@/types/tankify";
import SliderNumberField from "@/components/ui/SliderNumberField";

type Props = {
    t: TranslationSchema;
    localPrice: number;
    setLocalPrice: (value: number) => void;
    destinationPrice: number;
    setDestinationPrice: (value: number) => void;
    currencySystem: CurrencySystem;
    measurementSystem: MeasurementSystem;
};

export default function PriceSection({
    t,
    localPrice,
    setLocalPrice,
    destinationPrice,
    setDestinationPrice,
    currencySystem,
    measurementSystem,
}: Props) {
    const unit = measurementSystem === "metric" ? `${currencySystem}/L` : `${currencySystem}/gal`;

    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-bold">{t.pricing.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{t.pricing.description}</p>
            </div>

            <SliderNumberField
                label={t.pricing.localPrice}
                min={1}
                max={measurementSystem === "metric" ? 5 : 20}
                step={0.001}
                value={localPrice}
                onChange={setLocalPrice}
                unit={unit}
            />

            <SliderNumberField
                label={t.pricing.destinationPrice}
                min={1}
                max={measurementSystem === "metric" ? 5 : 20}
                step={0.001}
                value={destinationPrice}
                onChange={setDestinationPrice}
                unit={unit}
            />
        </section>
    );
}

