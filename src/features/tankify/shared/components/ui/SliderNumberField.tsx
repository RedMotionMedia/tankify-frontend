import { clamp, formatInputValue } from "../../lib/format";

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
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 1;
    const clamped = clamp(value, safeMin, safeMax);
    const pct =
        safeMax === safeMin ? 0 : ((clamped - safeMin) / (safeMax - safeMin)) * 100;
    const progressBg = `linear-gradient(90deg, #2563eb 0%, #2563eb ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    <div>
                        {label}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={Number(formatInputValue(value, step))}
                        onChange={(e) =>
                            onChange(clamp(Number(e.target.value || 0), safeMin, safeMax))
                        }
                        className="w-28 rounded-2xl border border-gray-300 bg-white px-3 py-2 text-right text-sm font-semibold text-gray-900 shadow-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                        aria-label={`${label} (${unit})`}
                    />
                    <span className="text-xs font-semibold text-gray-500">{unit}</span>
                </div>
            </div>

            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={clamped}
                onChange={(e) => onChange(Number(e.target.value))}
                className="tankify-range w-full"
                style={{ background: progressBg }}
                aria-label={label}
            />
        </div>
    );
}
