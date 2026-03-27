type Props = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    onSearch: () => void;
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
                                          onPickOnMap,
                                          onUseMyLocation,
                                          loading,
                                          pickActive,
                                          searchLabel,
                                          mapLabel,
                                          myLocationLabel,
                                      }: Props) {
    const hasMyLocation = Boolean(onUseMyLocation && myLocationLabel);
    const inputRightPadding = hasMyLocation ? "pr-32" : "pr-24";

    return (
        <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                {label}
            </label>

            <div className="relative">
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") onSearch();
                    }}
                    placeholder={label}
                    className={
                        "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none shadow-sm " +
                        "focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 " +
                        inputRightPadding
                    }
                />

                <div className="absolute inset-y-0 right-2 flex items-center gap-2">
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
