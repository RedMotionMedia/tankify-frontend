import { TranslationSchema } from "@/features/tankify/shared/config/i18n";
import { MeasurementSystem } from "@/features/tankify/shared/types/tankify";
import SliderNumberField from "../ui/SliderNumberField";

type Props = {
    t: TranslationSchema;
    measurementSystem: MeasurementSystem;
    consumption: number;
    setConsumption: (value: number) => void;
    tankSize: number;
    setTankSize: (value: number) => void;
    avgSpeed: number;
    setAvgSpeed: (value: number) => void;
};

export default function VehicleSection({
                                           t,
                                           measurementSystem,
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
                min={measurementSystem === "metric" ? 3 : 5}
                max={measurementSystem === "metric" ? 25 : 80}
                step={0.1}
                value={consumption}
                onChange={setConsumption}
                unit={
                    measurementSystem === "metric"
                        ? t.units.litersPer100Km
                        : t.units.mpg
                }
            />

            <SliderNumberField
                label={t.vehicle.tankSize}
                min={measurementSystem === "metric" ? 20 : 5}
                max={measurementSystem === "metric" ? 120 : 35}
                step={1}
                value={tankSize}
                onChange={setTankSize}
                unit={measurementSystem === "metric" ? t.units.liters : t.units.gallons}
            />

            <SliderNumberField
                label={t.vehicle.avgSpeed}
                min={measurementSystem === "metric" ? 30 : 20}
                max={measurementSystem === "metric" ? 130 : 80}
                step={1}
                value={avgSpeed}
                onChange={setAvgSpeed}
                unit={measurementSystem === "metric" ? t.units.kmh : t.units.mph}
            />
        </section>
    );
}
