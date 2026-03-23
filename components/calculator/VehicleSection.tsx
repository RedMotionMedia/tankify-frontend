import { TranslationSchema } from "@/config/i18n";
import SliderNumberField from "@/components/ui/SliderNumberField";

type Props = {
    t: TranslationSchema;
    consumption: number;
    setConsumption: (value: number) => void;
    tankSize: number;
    setTankSize: (value: number) => void;
    avgSpeed: number;
    setAvgSpeed: (value: number) => void;
};

export default function VehicleSection({
                                           t,
                                           consumption,
                                           setConsumption,
                                           tankSize,
                                           setTankSize,
                                           avgSpeed,
                                           setAvgSpeed,
                                       }: Props) {
    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-bold">{t.vehicle.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{t.vehicle.description}</p>
            </div>

            <SliderNumberField
                label={t.vehicle.consumption}
                min={3}
                max={25}
                step={0.1}
                value={consumption}
                onChange={setConsumption}
                unit="L / 100 km"
            />

            <SliderNumberField
                label={t.vehicle.tankSize}
                min={20}
                max={120}
                step={1}
                value={tankSize}
                onChange={setTankSize}
                unit="L"
            />

            <SliderNumberField
                label={t.vehicle.avgSpeed}
                min={30}
                max={130}
                step={1}
                value={avgSpeed}
                onChange={setAvgSpeed}
                unit="km/h"
            />
        </section>
    );
}