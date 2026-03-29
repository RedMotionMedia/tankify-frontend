import { TranslationSchema } from "@/features/tankify/shared/config/i18n";
import { MapPickMode, Point } from "@/features/tankify/shared/types/tankify";
import LocationField from "../ui/LocationField";

type Props = {
    t: TranslationSchema;
    startText: string;
    endText: string;
    setStartText: (value: string) => void;
    setEndText: (value: string) => void;
    onSearch: (type: "start" | "end") => void;
    onSuggestionPick: (type: "start" | "end", point: Point) => void;
    onClear: (type: "start" | "end") => void;
    onPickStart: () => void;
    onPickEnd: () => void;
    onUseMyLocationAsStart: () => void;
    onUseMyLocationAsDestination: () => void;
    onSwapStartEnd: () => void;
    searchLoading: "start" | "end" | null;
    mapPickMode: MapPickMode;
};

export default function RouteSection({
                                         t,
                                         startText,
                                         endText,
                                         setStartText,
                                         setEndText,
                                         onSearch,
                                         onSuggestionPick,
                                         onClear,
                                         onPickStart,
                                         onPickEnd,
                                         onUseMyLocationAsStart,
                                         onUseMyLocationAsDestination,
                                         onSwapStartEnd,
                                         searchLoading,
                                         mapPickMode,
                                     }: Props) {
    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-bold">{t.route.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{t.route.description}</p>
            </div>

            <LocationField
                label={t.route.start}
                value={startText}
                onChange={setStartText}
                onSearch={() => onSearch("start")}
                onSuggestionPick={(p) => onSuggestionPick("start", p)}
                onClear={() => onClear("start")}
                onPickOnMap={onPickStart}
                onUseMyLocation={onUseMyLocationAsStart}
                loading={searchLoading === "start"}
                pickActive={mapPickMode === "start"}
                searchLabel={t.actions.search}
                mapLabel={t.actions.map}
                myLocationLabel={t.route.myLocation}
            />

            <div className="flex items-center justify-center">
                <button
                    type="button"
                    onClick={onSwapStartEnd}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 active:scale-95"
                    aria-label={t.actions.swap}
                    title={t.actions.swap}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-gray-700"
                        aria-hidden="true"
                    >
                        <path
                            d="M8 7h11m0 0-3-3m3 3-3 3M16 17H5m0 0 3-3m-3 3 3 3"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <span className="text-sm">{t.actions.swap}</span>
                </button>
            </div>

            <LocationField
                label={t.route.destination}
                value={endText}
                onChange={setEndText}
                onSearch={() => onSearch("end")}
                onSuggestionPick={(p) => onSuggestionPick("end", p)}
                onClear={() => onClear("end")}
                onPickOnMap={onPickEnd}
                onUseMyLocation={onUseMyLocationAsDestination}
                loading={searchLoading === "end"}
                pickActive={mapPickMode === "end"}
                searchLabel={t.actions.search}
                mapLabel={t.actions.map}
                myLocationLabel={t.route.myLocation}
            />
        </section>
    );
}
