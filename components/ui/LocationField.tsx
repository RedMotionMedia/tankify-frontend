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
    return (
        <div>
            <label className="mb-2 block text-sm font-medium">{label}</label>

            <div className="flex gap-2 flex-col">
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") onSearch();
                    }}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none"
                />
                <div className="flex flex-row gap-2 w-full">
                    <button
                        type="button"
                        onClick={onSearch}
                        className="rounded-2xl bg-black px-4 py-3 text-white transition active:scale-95 hover:opacity-80 flex-auto"
                    >
                        {loading ? "..." : searchLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onPickOnMap}
                        className={`rounded-2xl px-4 py-3 text-white transition active:scale-95 flex-auto ${
                            pickActive
                                ? "bg-blue-600 hover:bg-blue-700"
                                : "bg-gray-700 hover:bg-gray-800"
                        }`}
                    >
                        {mapLabel}
                    </button>
                    {onUseMyLocation && myLocationLabel ? (
                        <button
                            type="button"
                            onClick={onUseMyLocation}
                            className="rounded-2xl bg-blue-600 px-4 py-3 text-white transition active:scale-95 hover:bg-blue-700 flex-auto"
                            title={myLocationLabel}
                            aria-label={myLocationLabel}
                        >
                            {myLocationLabel}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
