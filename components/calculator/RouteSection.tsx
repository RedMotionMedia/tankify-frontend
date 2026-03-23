import { TranslationSchema } from "@/config/i18n";
import { MapPickMode } from "@/types/tankify";
import LocationField from "@/components/ui/LocationField";

type Props = {
    t: TranslationSchema;
    startText: string;
    endText: string;
    setStartText: (value: string) => void;
    setEndText: (value: string) => void;
    onSearch: (type: "start" | "end") => void;
    onPickStart: () => void;
    onPickEnd: () => void;
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
                                         onPickStart,
                                         onPickEnd,
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
                onPickOnMap={onPickStart}
                loading={searchLoading === "start"}
                pickActive={mapPickMode === "start"}
                searchLabel={t.actions.search}
                mapLabel={t.actions.map}
            />

            <LocationField
                label={t.route.destination}
                value={endText}
                onChange={setEndText}
                onSearch={() => onSearch("end")}
                onPickOnMap={onPickEnd}
                loading={searchLoading === "end"}
                pickActive={mapPickMode === "end"}
                searchLabel={t.actions.search}
                mapLabel={t.actions.map}
            />
        </section>
    );
}