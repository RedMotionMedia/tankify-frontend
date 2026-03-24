"use client";

import dynamic from "next/dynamic";
import {useEffect, useMemo, useRef, useState} from "react";
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
import {
    gallonsToLiters,
    kmhToMph,
    litersToGallons,
    lPer100KmToMpg,
    mpgToLPer100Km,
    mphToKmh,
    pricePerGallonToPerLiter,
    pricePerLiterToPerGallon,
} from "@/lib/units";
import {CurrencySystem, FuelType, Language, MapPickMode, MeasurementSystem, Point,} from "@/types/tankify";
import WorthPanel from "@/components/calculator/WorthPanel";

const MapPicker = dynamic(() => import("@/components/map/MapPicker"), {
    ssr: false,
});

export default function TankifyCalculator() {
    const [language, setLanguage] = useState<Language>("de");
    const [currencySystem, setCurrencySystem] = useState<CurrencySystem>("eur");
    const [measurementSystem, setMeasurementSystem] =
        useState<MeasurementSystem>("metric");
    const previousMeasurementSystem = useRef<MeasurementSystem>("metric");

    const [settingsOpen, setSettingsOpen] = useState(false);

    const [startText, setStartText] = useState("Linz");
    const [endText, setEndText] = useState("Vyšší Brod");

    const [startPoint, setStartPoint] = useState<Point>(DEFAULT_START);
    const [endPoint, setEndPoint] = useState<Point>(DEFAULT_END);

    const [fuelType, setFuelType] = useState<FuelType>("diesel");

    // These are always stored in the CURRENT visible unit system.
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
        isSheetReady,
        onTouchStart,
        onTouchMoveHandle,
        onTouchMoveContent,
        onTouchEnd,
        minimizeBottomSheet,
    } = useBottomSheet();

    const {routeData, routeLoading, routeError} = useRoute(startPoint, endPoint);
    const t = getTranslations(language);

    useEffect(() => {

        const savedLanguage = window.localStorage.getItem("tankify-language");
        const savedCurrency = window.localStorage.getItem("tankify-currency");
        const savedMeasurement = window.localStorage.getItem("tankify-measurement");

        if (savedLanguage === "de" || savedLanguage === "en") {
            setLanguage(savedLanguage);
        }

        if (savedCurrency === "eur" || savedCurrency === "usd") {
            setCurrencySystem(savedCurrency);
        }

        if (savedMeasurement === "metric" || savedMeasurement === "imperial") {
            setMeasurementSystem(savedMeasurement);
            previousMeasurementSystem.current = savedMeasurement;
        }
    }, []);

    useEffect(() => {
        window.localStorage.setItem("tankify-language", language);
    }, [language]);

    useEffect(() => {
        window.localStorage.setItem("tankify-currency", currencySystem);
    }, [currencySystem]);

    useEffect(() => {
        window.localStorage.setItem("tankify-measurement", measurementSystem);
    }, [measurementSystem]);

    // Convert current input values when switching unit system
    useEffect(() => {
        const prev = previousMeasurementSystem.current;

        if (prev === measurementSystem) return;

        if (prev === "metric" && measurementSystem === "imperial") {
            setLocalPrice((prevValue) => pricePerLiterToPerGallon(prevValue));
            setDestinationPrice((prevValue) => pricePerLiterToPerGallon(prevValue));
            setConsumption((prevValue) => lPer100KmToMpg(prevValue));
            setTankSize((prevValue) => litersToGallons(prevValue));
            setAvgSpeed((prevValue) => kmhToMph(prevValue));
        }

        if (prev === "imperial" && measurementSystem === "metric") {
            setLocalPrice((prevValue) => pricePerGallonToPerLiter(prevValue));
            setDestinationPrice((prevValue) => pricePerGallonToPerLiter(prevValue));
            setConsumption((prevValue) => mpgToLPer100Km(prevValue));
            setTankSize((prevValue) => gallonsToLiters(prevValue));
            setAvgSpeed((prevValue) => mphToKmh(prevValue));
        }

        previousMeasurementSystem.current = measurementSystem;
    }, [measurementSystem]);

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

    // Normalize current input values into metric/base variables
    const localPricePerLiter =
        measurementSystem === "metric"
            ? localPrice
            : pricePerGallonToPerLiter(localPrice);

    const localPricePerGallon = pricePerLiterToPerGallon(localPricePerLiter);

    const destinationPricePerLiter =
        measurementSystem === "metric"
            ? destinationPrice
            : pricePerGallonToPerLiter(destinationPrice);

    const destinationPricePerGallon = pricePerLiterToPerGallon(
        destinationPricePerLiter
    );

    const consumptionLPer100Km =
        measurementSystem === "metric" ? consumption : mpgToLPer100Km(consumption);

    const consumptionMpg = lPer100KmToMpg(consumptionLPer100Km);

    const tankSizeLiters =
        measurementSystem === "metric" ? tankSize : gallonsToLiters(tankSize);

    const tankSizeGallons = litersToGallons(tankSizeLiters);

    const avgSpeedKmh =
        measurementSystem === "metric" ? avgSpeed : mphToKmh(avgSpeed);

    const avgSpeedMph = kmhToMph(avgSpeedKmh);

    const calculation = useMemo(() => {
        return calculateTankify({
            oneWayKm: routeData?.distanceKm ?? 0,
            durationHours: routeData?.durationHours ?? 0,
            localPricePerLiter,
            destinationPricePerLiter,
            consumptionLPer100Km,
            tankSizeLiters,
            avgSpeedKmh,
        });
    }, [
        routeData,
        localPricePerLiter,
        destinationPricePerLiter,
        consumptionLPer100Km,
        tankSizeLiters,
        avgSpeedKmh,
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
                    setMapPickMode((prev) => (prev === "start" ? null : "start"));
                    minimizeBottomSheet();
                }}
                onPickEnd={() => {
                    setMapPickMode((prev) => (prev === "end" ? null : "end"));
                    minimizeBottomSheet();
                }}
                searchLoading={searchLoading}
                mapPickMode={mapPickMode}
            />

            <PriceSection
                t={t}
                localPrice={measurementSystem === "metric" ? localPricePerLiter : localPricePerGallon}
                setLocalPrice={setLocalPrice}
                destinationPrice={
                    measurementSystem === "metric"
                        ? destinationPricePerLiter
                        : destinationPricePerGallon
                }
                setDestinationPrice={setDestinationPrice}
                currencySystem={currencySystem}
                measurementSystem={measurementSystem}
            />

            {mapPickMode ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    {mapPickMode === "start" ? t.route.pickHintStart : t.route.pickHintDestination}.
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
                currencySystem={currencySystem}
                setCurrencySystem={setCurrencySystem}
                measurementSystem={measurementSystem}
                setMeasurementSystem={setMeasurementSystem}
                consumption={measurementSystem === "metric" ? consumptionLPer100Km : consumptionMpg}
                setConsumption={setConsumption}
                tankSize={measurementSystem === "metric" ? tankSizeLiters : tankSizeGallons}
                setTankSize={setTankSize}
                avgSpeed={measurementSystem === "metric" ? avgSpeedKmh : avgSpeedMph}
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
                                    measurementSystem={measurementSystem}
                                    currencySystem={currencySystem}
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

                                        if (price != null) {
                                            setLocalPrice(
                                                measurementSystem === "metric"
                                                    ? price
                                                    : pricePerLiterToPerGallon(price)
                                            );
                                        }
                                    }}
                                    onSelectStationAsDestination={({point, price}) => {
                                        setEndPoint(point);
                                        setEndText(point.label);

                                        if (price != null) {
                                            setDestinationPrice(
                                                measurementSystem === "metric"
                                                    ? price
                                                    : pricePerLiterToPerGallon(price)
                                            );
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <WorthPanel
                            t={t}
                            currencySystem={currencySystem}
                            profit={profit}
                            netSaving={calculation.netSaving}
                        />

                        <ResultsPanel
                            t={t}
                            currencySystem={currencySystem}
                            measurementSystem={measurementSystem}
                            profit={profit}
                            routeLoading={routeLoading}
                            calculation={calculation}
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
                            measurementSystem={measurementSystem}
                            currencySystem={currencySystem}
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

                                if (price != null) {
                                    setLocalPrice(
                                        measurementSystem === "metric"
                                            ? price
                                            : pricePerLiterToPerGallon(price)
                                    );
                                }
                            }}
                            onSelectStationAsDestination={({point, price}) => {
                                setEndPoint(point);
                                setEndText(point.label);

                                if (price != null) {
                                    setDestinationPrice(
                                        measurementSystem === "metric"
                                            ? price
                                            : pricePerLiterToPerGallon(price)
                                    );
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
                        >
                            ⚙️
                        </button>
                    </div>

                    <MobileBottomSheet
                        t={t}
                        currencySystem={currencySystem}
                        measurementSystem={measurementSystem}
                        sheetContentRef={sheetContentRef}
                        sheetY={sheetY}
                        dragging={dragging}
                        isSheetReady={isSheetReady}
                        onTouchStart={onTouchStart}
                        onTouchMoveHandle={onTouchMoveHandle}
                        onTouchMoveContent={onTouchMoveContent}
                        onTouchEnd={onTouchEnd}
                        controls={routeControls}
                        routeLoading={routeLoading}
                        calculation={calculation}
                        profit={profit}
                    />
                </div>
            </main>
        </>
    );
}