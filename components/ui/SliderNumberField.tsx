import { clamp, formatInputValue } from "@/lib/format";

type Props = {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
    unit: string;
};

export default function SliderNumberField({
                                              label,
                                              min,
                                              max,
                                              step,
                                              value,
                                              onChange,
                                              unit,
                                          }: Props) {
    return (
        <div>
            <label className="mb-2 block text-sm font-medium">
                {label}: <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={Number(formatInputValue(value, step))}
                onChange={(e) => onChange(clamp(Number(e.target.value || 0), min, max))}
                className="rounded-xl border border-gray-300 px-3 py-2 w-20 sm:w-auto"
            /> {unit}
            </label>

            <div className="flex gap-3 flex-row sm:items-center">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full"
                />


            </div>
        </div>
    );
}