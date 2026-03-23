import { TranslationSchema } from "@/config/i18n";
import { FuelType } from "@/types/tankify";
import SliderNumberField from "@/components/ui/SliderNumberField";

type Props = {
    t: TranslationSchema;
    fuelType: FuelType;
    setFuelType: (value: FuelType) => void;
    localPrice: number;
    setLocalPrice: (value: number) => void;
    destinationPrice: number;
    setDestinationPrice: (value: number) => void;
};

export default function PriceSection({
                                         t,
                                         fuelType,
                                         setFuelType,
                                         localPrice,
                                         setLocalPrice,
                                         destinationPrice,
                                         setDestinationPrice,
                                     }: Props) {
    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-bold">{t.pricing.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{t.pricing.description}</p>
            </div>

            <div>
                <label className="mb-2 block text-sm font-medium">
                    {t.pricing.fuelType}
                </label>
                <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value as FuelType)}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none"
                >
                    <option value="diesel">{t.pricing.diesel}</option>
                    <option value="super95">{t.pricing.super95}</option>
                </select>
            </div>

            <SliderNumberField
                label={t.pricing.localPrice}
                min={1}
                max={3}
                step={0.001}
                value={localPrice}
                onChange={setLocalPrice}
                unit="€/L"
            />

            <SliderNumberField
                label={t.pricing.destinationPrice}
                min={1}
                max={3}
                step={0.001}
                value={destinationPrice}
                onChange={setDestinationPrice}
                unit="€/L"
            />
        </section>
    );
}