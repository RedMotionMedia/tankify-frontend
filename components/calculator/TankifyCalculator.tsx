"use client";

import dynamic from "next/dynamic";
import {useEffect, useMemo, useState} from "react";
import RouteSection from "./RouteSection";
import PriceSection from "./PriceSection";
import ResultsPanel from "./ResultsPanel";
import MobileBottomSheet from "./MobileBottomSheet";
import SettingsModal from "./SettingsModal";
import {getTranslations} from "@/config/i18n";
import {DEFAULT_END, DEFAULT_START} from "@/lib/constants";
import {calculateTankify, getProfitLevel} from "@/lib/calc";
import {geocode} from "@/lib/geocode";
import {useRoute} from "@/hooks/useRoute";
import {useBottomSheet} from "@/hooks/useBottomSheet";
import {FuelType, Language, MapPickMode, Point} from "@/types/tankify";
import WorthPanel from "@/components/calculator/WorthPanel";

const MapPicker = dynamic(() => import("@/components/map/MapPicker"), {
    ssr: false,
});

export default function TankifyCalculator() {
    const [language, setLanguage] = useState<Language>("de");
    const [settingsOpen, setSettingsOpen] = useState(false);

    const [startText, setStartText] = useState("Linz");
    const [endText, setEndText] = useState("Vyšší Brod");

    const [startPoint, setStartPoint] = useState<Point>(DEFAULT_START);
    const [endPoint, setEndPoint] = useState<Point>(DEFAULT_END);

    const [fuelType, setFuelType] = useState<FuelType>("diesel");
    const [localPrice, setLocalPrice] = useState(2.142);
    const [destinationPrice, setDestinationPrice] = useState(1.585);
    const [consumption, setConsumption] = useState(6.0);
    const [tankSize, setTankSize] = useState(45);
    const [avgSpeed, setAvgSpeed] = useState(70);

    const [searchLoading, setSearchLoading] = useState<"start" | "end" | null>(null);
    const [error, setError] = useState("");
    const [mapPickMode, setMapPickMode] = useState<MapPickMode>(null);

    const {
        sheetContentRef,
        sheetY,
        dragging,
        onTouchStart,
        onTouchMoveHandle,
        onTouchMoveContent,
        onTouchEnd,
        minimizeBottomSheet,
        setBottomSheet,
    } = useBottomSheet();

    const {routeData, routeLoading, routeError} = useRoute(startPoint, endPoint);

    const t = getTranslations(language);

    useEffect(() => {
        const saved = window.localStorage.getItem("tankify-language");
        if (saved === "de" || saved === "en") {
            setLanguage(saved);
        }
    }, []);

    useEffect(() => {
        window.localStorage.setItem("tankify-language", language);
    }, [language]);

    useEffect(() => {
        if (routeError === "ROUTE_NOT_CALCULATED") {
            setError(t.errors.routeNotCalculated);
            return;
        }

        if (routeError === "ROUTE_LOAD_FAILED") {
            setError(t.errors.routeLoadFailed);
            return;
        }

        if (!routeError) {
            setError("");
        }
    }, [routeError, t]);

    async function handleSearch(type: "start" | "end") {
        try {
            setError("");
            setSearchLoading(type);

            const query = type === "start" ? startText : endText;
            const point = await geocode(query);

            if (!point) {
                setError(type === "start" ? t.errors.noStartFound : t.errors.noDestinationFound);
                return;
            }

            if (type === "start") {
                setStartPoint(point);
                setStartText(point.label);
            } else {
                setEndPoint(point);
                setEndText(point.label);
            }
        } catch (err) {
            if (err instanceof Error && err.message === "GEOCODE_FAILED") {
                setError(t.errors.geocodeFailed);
            } else {
                setError(t.errors.searchFailed);
            }
        } finally {
            setSearchLoading(null);
        }
    }

    const calculation = useMemo(() => {
        setBottomSheet(window.innerHeight*0.2);
        return calculateTankify({
            oneWayKm: routeData?.distanceKm ?? 0,
            durationHours: routeData?.durationHours ?? 0,
            localPrice,
            destinationPrice,
            consumption,
            tankSize,
            avgSpeed,
        });
    }, [
        routeData,
        localPrice,
        destinationPrice,
        consumption,
        tankSize,
        avgSpeed,
    ]);

    const profit = useMemo(
        () => getProfitLevel(calculation.netSaving),
        [calculation.netSaving]
    );

    const routeControls = (
        <div className="space-y-6">
            <RouteSection
                t={t}
                startText={startText}
                endText={endText}
                setStartText={setStartText}
                setEndText={setEndText}
                onSearch={handleSearch}
                onPickStart={() => {
                    setMapPickMode("start");
                    minimizeBottomSheet();
                }}
                onPickEnd={() => {
                    setMapPickMode("end");
                    minimizeBottomSheet();
                }}
                searchLoading={searchLoading}
                mapPickMode={mapPickMode}
            />

            <PriceSection
                t={t}
                fuelType={fuelType}
                setFuelType={setFuelType}
                localPrice={localPrice}
                setLocalPrice={setLocalPrice}
                destinationPrice={destinationPrice}
                setDestinationPrice={setDestinationPrice}
            />

            {mapPickMode ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    {t.route.pickHint}{" "}
                    {mapPickMode === "start" ? t.route.pickStart : t.route.pickDestination}.
                </div>
            ) : null}

            {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            ) : null}
        </div>
    );

    return (
        <>
            <SettingsModal
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                t={t}
                language={language}
                setLanguage={setLanguage}
                fuelType={fuelType}
                setFuelType={setFuelType}
                consumption={consumption}
                setConsumption={setConsumption}
                tankSize={tankSize}
                setTankSize={setTankSize}
                avgSpeed={avgSpeed}
                setAvgSpeed={setAvgSpeed}
            />

            <main className="min-h-screen bg-white md:bg-neutral-100 md:p-8">
                <div className="mx-auto hidden max-w-7xl gap-6 p-4 lg:grid lg:grid-cols-[420px_1fr] lg:items-start">
                    <section className="self-start rounded-3xl bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h1 className="text-3xl font-bold">{t.app.title}</h1>
                                <p className="mt-2 text-sm text-gray-600">{t.app.subtitle}</p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSettingsOpen(true)}
                                className="rounded-2xl border border-gray-200 px-3 py-2 text-lg shadow-sm transition hover:bg-gray-50"
                                aria-label="Open settings"
                                title="Settings"
                            >
                                ⚙️
                            </button>
                        </div>

                        <div className="mt-6">{routeControls}</div>
                    </section>

                    <section className="space-y-6">
                        <div className="map-resizable rounded-3xl bg-white shadow-sm">
                            <div className="h-full overflow-hidden rounded-3xl">
                                <MapPicker
                                    start={startPoint}
                                    end={endPoint}
                                    routeGeometry={routeData?.geometry ?? []}
                                    pickMode={mapPickMode}
                                    fuelType={fuelType}
                                    t={t}
                                    onMapPick={(type, point) => {
                                        if (type === "start") {
                                            setStartPoint(point);
                                            setStartText(point.label);
                                        } else {
                                            setEndPoint(point);
                                            setEndText(point.label);
                                        }
                                        setMapPickMode(null);
                                    }}
                                    onSelectStationAsStart={({point, price}) => {
                                        setStartPoint(point);
                                        setStartText(point.label);

                                        if (price !== null && price !== undefined) {
                                            setLocalPrice(price);
                                        }
                                    }}
                                    onSelectStationAsDestination={({point, price}) => {
                                        setEndPoint(point);
                                        setEndText(point.label);

                                        if (price !== null && price !== undefined) {
                                            setDestinationPrice(price);
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <WorthPanel
                            t={t}
                            language={language}
                            profit={profit}
                            netSaving={calculation.netSaving}/>

                        <ResultsPanel
                            t={t}
                            language={language}
                            profit={profit}
                            routeLoading={routeLoading}
                            oneWayKm={routeData?.distanceKm ?? 0}
                            roundTripKm={calculation.roundTripKm}
                            priceDifference={calculation.priceDifference}
                            tripCost={calculation.tripCost}
                            estimatedHoursOneWay={calculation.estimatedHoursOneWay}
                            estimatedHoursRoundTrip={calculation.estimatedHoursRoundTrip}
                            grossSavingFullTank={calculation.grossSavingFullTank}
                            netSaving={calculation.netSaving}
                            breakEvenDiff={calculation.breakEvenDiff}
                            maxConsumption={calculation.maxConsumption}
                        />
                    </section>
                </div>

                <div className="lg:hidden">
                    <div className="fixed inset-0 z-0 h-svh w-screen bg-white">
                        <MapPicker
                            start={startPoint}
                            end={endPoint}
                            routeGeometry={routeData?.geometry ?? []}
                            pickMode={mapPickMode}
                            fuelType={fuelType}
                            t={t}
                            onMapPick={(type, point) => {
                                if (type === "start") {
                                    setStartPoint(point);
                                    setStartText(point.label);
                                } else {
                                    setEndPoint(point);
                                    setEndText(point.label);
                                }
                                setMapPickMode(null);
                            }}
                            onSelectStationAsStart={({point, price}) => {
                                setStartPoint(point);
                                setStartText(point.label);

                                if (price !== null && price !== undefined) {
                                    setLocalPrice(price);
                                }
                            }}
                            onSelectStationAsDestination={({point, price}) => {
                                setEndPoint(point);
                                setEndText(point.label);

                                if (price !== null && price !== undefined) {
                                    setDestinationPrice(price);
                                }
                            }}
                        />
                    </div>

                    <div className="fixed left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2">
                        <div className="rounded-full bg-white/90 px-4 py-2 shadow-md backdrop-blur">
                            <h1 className="text-lg font-bold">{t.app.title}</h1>
                        </div>

                        <button
                            type="button"
                            onClick={() => setSettingsOpen(true)}
                            className="rounded-full bg-white/90 px-3 py-2 text-lg shadow-md backdrop-blur"
                            aria-label="Open settings"
                            title="Settings"
                        >
                            ⚙️
                        </button>
                    </div>

                    <MobileBottomSheet
                        t={t}
                        language={language}
                        sheetContentRef={sheetContentRef}
                        sheetY={sheetY}
                        dragging={dragging}
                        onTouchStart={onTouchStart}
                        onTouchMoveHandle={onTouchMoveHandle}
                        onTouchMoveContent={onTouchMoveContent}
                        onTouchEnd={onTouchEnd}
                        controls={routeControls}
                        routeLoading={routeLoading}
                        oneWayKm={routeData?.distanceKm ?? 0}
                        roundTripKm={calculation.roundTripKm}
                        priceDifference={calculation.priceDifference}
                        tripCost={calculation.tripCost}
                        estimatedHoursOneWay={calculation.estimatedHoursOneWay}
                        estimatedHoursRoundTrip={calculation.estimatedHoursRoundTrip}
                        grossSavingFullTank={calculation.grossSavingFullTank}
                        netSaving={calculation.netSaving}
                        breakEvenDiff={calculation.breakEvenDiff}
                        maxConsumption={calculation.maxConsumption}
                        profit={profit}
                    />
                </div>
            </main>
        </>
    );
}