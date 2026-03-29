import { useEffect, useRef, useState } from "react";
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

    // Keep a local draft so the user can temporarily clear the input while typing.
    const [draft, setDraft] = useState<string>(() => formatInputValue(clamped, step));
    const editingRef = useRef(false);
    useEffect(() => {
        if (editingRef.current) return;
        // We intentionally sync the input draft when the controlled value changes externally.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraft(formatInputValue(clamped, step));
    }, [clamped, step]);

    const pct =
        safeMax === safeMin ? 0 : ((clamped - safeMin) / (safeMax - safeMin)) * 100;
    const progressBg = `linear-gradient(90deg, #2563eb 0%, #2563eb ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`;

    const commitDraft = () => {
        const raw = draft.trim();
        if (!raw) {
            setDraft(formatInputValue(clamped, step));
            return;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) {
            setDraft(formatInputValue(clamped, step));
            return;
        }
        const next = clamp(n, safeMin, safeMax);
        onChange(next);
        setDraft(formatInputValue(next, step));
    };

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
                        value={draft}
                        onFocus={() => {
                            editingRef.current = true;
                        }}
                        onBlur={() => {
                            editingRef.current = false;
                            commitDraft();
                        }}
                        onChange={(e) => {
                            const nextDraft = e.target.value;
                            setDraft(nextDraft);

                            // Allow temporary empty/partial input states.
                            if (!nextDraft.trim()) return;
                            if (nextDraft === "-" || nextDraft === "." || nextDraft === "-.") return;

                            const n = Number(nextDraft);
                            if (!Number.isFinite(n)) return;
                            onChange(clamp(n, safeMin, safeMax));
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                commitDraft();
                                (e.currentTarget as HTMLInputElement).blur();
                            }
                        }}
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
                onChange={(e) => {
                    const next = Number(e.target.value);
                    onChange(next);
                    // If the user drags the slider, keep the input in sync.
                    if (!editingRef.current) setDraft(formatInputValue(next, step));
                }}
                className="tankify-range w-full"
                style={{ background: progressBg }}
                aria-label={label}
            />
        </div>
    );
}
