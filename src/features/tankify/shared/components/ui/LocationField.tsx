import { useEffect, useRef, useState } from "react";
import { geocodeSuggestions } from "@/features/tankify/shared/lib/geocode";
import type { Point } from "@/features/tankify/shared/types/tankify";

type Props = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    onSearch: () => void;
    onSuggestionPick?: (point: Point) => void;
    onClear?: () => void;
    onPickOnMap: () => void;
    onUseMyLocation?: () => void;
    loading: boolean;
    pickActive: boolean;
    searchLabel: string;
    mapLabel: string;
    myLocationLabel?: string;
};

export default function LocationField({
                                          label,
                                          value,
                                          onChange,
                                          onSearch,
                                          onSuggestionPick,
                                          onClear,
                                          onPickOnMap,
                                          onUseMyLocation,
                                          loading,
                                          pickActive,
                                          searchLabel,
                                          mapLabel,
                                          myLocationLabel,
                                      }: Props) {
    const hasMyLocation = Boolean(onUseMyLocation && myLocationLabel);
    const showClear = value.trim().length > 0;
    const inputRightPadding = hasMyLocation
        ? showClear
            ? "pr-44"
            : "pr-32"
        : showClear
            ? "pr-32"
            : "pr-24";

    const rootRef = useRef<HTMLDivElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<Point[]>([]);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => {
        if (!open) return;

        const q = value.trim();
        if (q.length < 3) {
            abortRef.current?.abort();
            setSuggestions([]);
            setSuggestLoading(false);
            setActiveIndex(-1);
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setSuggestLoading(true);
        const t = window.setTimeout(() => {
            void (async () => {
                try {
                    const results = await geocodeSuggestions(q, 6);
                    if (controller.signal.aborted) return;
                    setSuggestions(results);
                    setActiveIndex(results.length > 0 ? 0 : -1);
                } catch {
                    if (controller.signal.aborted) return;
                    setSuggestions([]);
                    setActiveIndex(-1);
                } finally {
                    if (controller.signal.aborted) return;
                    setSuggestLoading(false);
                }
            })();
        }, 250);

        return () => {
            window.clearTimeout(t);
            controller.abort();
        };
    }, [open, value]);

    function close() {
        setOpen(false);
        setActiveIndex(-1);
    }

    function applySuggestion(p: Point) {
        onChange(p.label);
        if (onSuggestionPick) onSuggestionPick(p);
        else onSearch();
        close();
    }

    function clearValue() {
        if (onClear) onClear();
        else onChange("");
        close();
    }

    return (
        <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                {label}
            </label>

            <div
                ref={rootRef}
                className="relative"
                onFocus={() => setOpen(true)}
                onBlur={() => {
                    // Close only when focus fully leaves this field (input + dropdown).
                    window.requestAnimationFrame(() => {
                        const root = rootRef.current;
                        const active = document.activeElement;
                        if (!root || !active) return close();
                        if (!root.contains(active)) close();
                    });
                }}
            >
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                            if (!open) setOpen(true);
                            e.preventDefault();
                            setActiveIndex((i) => {
                                const next = i + 1;
                                return next >= suggestions.length ? i : next;
                            });
                            return;
                        }
                        if (e.key === "ArrowUp") {
                            if (!open) setOpen(true);
                            e.preventDefault();
                            setActiveIndex((i) => Math.max(0, i - 1));
                            return;
                        }
                        if (e.key === "Escape") {
                            e.preventDefault();
                            close();
                            return;
                        }
                        if (e.key === "Enter") {
                            if (open && activeIndex >= 0 && activeIndex < suggestions.length) {
                                e.preventDefault();
                                applySuggestion(suggestions[activeIndex]);
                                return;
                            }
                            onSearch();
                        }
                    }}
                    placeholder={label}
                    className={
                        "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none shadow-sm " +
                        "focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 " +
                        inputRightPadding
                    }
                />

                {open && (suggestLoading || suggestions.length > 0) ? (
                    <div className="absolute left-0 right-0 top-full z-[60] mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                        {suggestLoading ? (
                            <div className="px-3 py-2 text-xs font-medium text-gray-600">
                                Vorschlaege werden geladen...
                            </div>
                        ) : null}

                        {suggestions.map((s, idx) => {
                            const key = `${s.lat},${s.lon}`;
                            const active = idx === activeIndex;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()} // keep input focus
                                    onClick={() => applySuggestion(s)}
                                    className={
                                        "block w-full px-3 py-2 text-left text-[12px] transition " +
                                        (active ? "bg-blue-50 text-blue-900" : "text-gray-900 hover:bg-gray-50")
                                    }
                                >
                                    <span className="line-clamp-2">{s.label}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : null}

                <div className="absolute inset-y-0 right-2 flex items-center gap-2">
                    {showClear ? (
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={clearValue}
                            title="Clear"
                            aria-label="Clear"
                            className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-700 shadow-sm transition hover:bg-gray-200 active:scale-95"
                        >
                            <svg
                                viewBox="0 0 20 20"
                                className="h-4 w-4"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <path
                                    d="M5 5l10 10M15 5L5 15"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    ) : null}
                    {hasMyLocation ? (
                        <button
                            type="button"
                            onClick={onUseMyLocation}
                            title={myLocationLabel}
                            aria-label={myLocationLabel}
                            className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                className="h-6 w-6"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <path d="M12 2l7 19-7-3-7 3 7-19z" fill="currentColor" />
                            </svg>
                        </button>
                    ) : null}

                    <button
                        type="button"
                        onClick={onPickOnMap}
                        title={mapLabel}
                        aria-label={mapLabel}
                        className={
                            "grid h-9 w-9 place-items-center rounded-full shadow-sm transition active:scale-95 " +
                            (pickActive
                                ? "bg-gray-900 text-white hover:bg-gray-800"
                                : "bg-gray-100 text-gray-800 hover:bg-gray-200")
                        }
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path
                                d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M9 3v15M15 6v15"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>

                    <button
                        type="button"
                        onClick={onSearch}
                        title={searchLabel}
                        aria-label={searchLabel}
                        className="grid h-9 w-9 place-items-center rounded-full bg-black text-white shadow-sm transition hover:bg-gray-900 active:scale-95"
                    >
                        {loading ? (
                            <svg
                                viewBox="0 0 20 20"
                                className="h-5 w-5 animate-spin"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <path
                                    d="M10 2a8 8 0 1 0 8 8"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                        ) : (
                            <svg
                                viewBox="0 0 20 20"
                                className="h-5 w-5"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <path
                                    d="M12.5 12.5l4 4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                                <circle
                                    cx="8.5"
                                    cy="8.5"
                                    r="5.5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
