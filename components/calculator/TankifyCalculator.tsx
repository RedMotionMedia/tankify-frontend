"use client";

import dynamic from "next/dynamic";
import {useEffect, useMemo, useRef, useState} from "react";
import RouteSection from "./RouteSection";
import PriceSection from "./PriceSection";
import ResultsPanel from "./ResultsPanel";
import MobileBottomSheet from "./MobileBottomSheet";
import SettingsModal from "./SettingsModal";
import VehicleModal from "./VehicleModal";
import {getTranslations} from "@/config/i18n";
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
import {
    CurrencySystem,
    FuelType,
    Language,
    MapPickMode,
    MeasurementSystem,
    Point,
    Station,
} from "@/types/tankify";
import WorthPanel from "@/components/calculator/WorthPanel";
import StationsSidebar from "@/components/map/StationsSidebar";

const MapPicker = dynamic(() => import("@/components/map/MapPicker"), {
    ssr: false,
});

export default function TankifyCalculator() {
    const [language, setLanguage] = useState<Language>("de");
    const [currencySystem, setCurrencySystem] = useState<CurrencySystem>("eur");
    const [measurementSystem, setMeasurementSystem] =
        useState<MeasurementSystem>("metric");
    const [storageReady, setStorageReady] = useState(false);
    const [debugMode, setDebugMode] = useState(false);

    const debugAllowed = process.env.NODE_ENV !== "production" ||
        (process.env.NEXT_PUBLIC_ENABLE_DEBUG_MODE ?? "").trim() === "1";

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [vehicleModalOpen, setVehicleModalOpen] = useState(false);

    const [startText, setStartText] = useState("");
    const [endText, setEndText] = useState("");

    // Draft points are what the user is currently editing/selecting.
    const [draftStartPoint, setDraftStartPoint] = useState<Point | null>(null);
    const [draftEndPoint, setDraftEndPoint] = useState<Point | null>(null);

    // Committed points are what the current route/results are based on.
    const [calcStartPoint, setCalcStartPoint] = useState<Point | null>(null);
    const [calcEndPoint, setCalcEndPoint] = useState<Point | null>(null);
    const [routeRequestId, setRouteRequestId] = useState(0);

    const [fuelType, setFuelType] = useState<FuelType>("diesel");

    // Persist and calculate in metric/base units to avoid "unit interpretation" bugs.
    const [localPricePerLiter, setLocalPricePerLiter] = useState(2.142);
    const [destinationPricePerLiter, setDestinationPricePerLiter] = useState(1.585);
    const [consumptionLPer100Km, setConsumptionLPer100Km] = useState(6.0);
    const [tankSizeLiters, setTankSizeLiters] = useState(45);
    const [avgSpeedKmh, setAvgSpeedKmh] = useState(70);

    const [searchLoading, setSearchLoading] = useState<"start" | "end" | null>(null);
    const [error, setError] = useState("");
    const [mapPickMode, setMapPickMode] = useState<MapPickMode>(null);

    const [visibleStations, setVisibleStations] = useState<Station[]>([]);
    const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [stationsQueried, setStationsQueried] = useState(false);

    const {
        sheetContentRef,
        sheetY,
        dragging,
        isSheetReady,
        snapWorthMultiplicator,
        onTouchStart,
        onTouchMoveHandle,
        onTouchMoveContent,
        onTouchEnd,
        minimizeBottomSheet,
        setBottomSheet,
    } = useBottomSheet();

    const {routeData, routeLoading, routeError} = useRoute(
        calcStartPoint,
        calcEndPoint,
        routeRequestId
    );
    const t = getTranslations(language);
    const myLocationReqIdRef = useRef(0);

    useEffect(() => {


        const savedLanguage = window.localStorage.getItem("tankify-language");
        const savedCurrency = window.localStorage.getItem("tankify-currency");
        const savedMeasurement = window.localStorage.getItem("tankify-measurement");
        const savedFuelType = window.localStorage.getItem("tankify-fuelType");
        const savedDebugMode = window.localStorage.getItem("tankify-debug-mode");
        const savedInputsRaw = window.localStorage.getItem("tankify-inputs-v1");

        if (savedLanguage === "de" || savedLanguage === "en") {
            setLanguage(savedLanguage);
        }

        if (savedCurrency === "eur" || savedCurrency === "usd") {
            setCurrencySystem(savedCurrency);
        }

        if (savedMeasurement === "metric" || savedMeasurement === "imperial") {
            setMeasurementSystem(savedMeasurement);
        }

        if (savedFuelType === "diesel" || savedFuelType === "super95") {
            setFuelType(savedFuelType);
        }

        if (savedDebugMode === "1" && debugAllowed) {
            setDebugMode(true);
        }

        if (savedInputsRaw) {
            try {
                const parsed = JSON.parse(savedInputsRaw) as Partial<{
                    localPricePerLiter: number;
                    destinationPricePerLiter: number;
                    consumptionLPer100Km: number;
                    tankSizeLiters: number;
                    avgSpeedKmh: number;
                }>;

                if (typeof parsed.localPricePerLiter === "number") {
                    setLocalPricePerLiter(parsed.localPricePerLiter);
                }
                if (typeof parsed.destinationPricePerLiter === "number") {
                    setDestinationPricePerLiter(parsed.destinationPricePerLiter);
                }
                if (typeof parsed.consumptionLPer100Km === "number") {
                    setConsumptionLPer100Km(parsed.consumptionLPer100Km);
                }
                if (typeof parsed.tankSizeLiters === "number") {
                    setTankSizeLiters(parsed.tankSizeLiters);
                }
                if (typeof parsed.avgSpeedKmh === "number") {
                    setAvgSpeedKmh(parsed.avgSpeedKmh);
                }
            } catch {
                // ignore invalid JSON
            }
        }

        setStorageReady(true);
    }, [debugAllowed]);

    useEffect(() => {
        if (!storageReady) return;
        try {
            const key = "tankify-vehicle-onboarded-v1";
            if (window.localStorage.getItem(key) !== "1") {
                setVehicleModalOpen(true);
            }
        } catch {
            setVehicleModalOpen(true);
        }
    }, [storageReady]);

    useEffect(() => {
        if (debugAllowed) return;
        setDebugMode(false);
        try {
            window.localStorage.removeItem("tankify-debug-mode");
        } catch {}
    }, [debugAllowed]);

    useEffect(() => {
        if (!storageReady) return;
        window.localStorage.setItem("tankify-language", language);
    }, [language, storageReady]);

    useEffect(() => {
        if (!storageReady) return;
        window.localStorage.setItem("tankify-currency", currencySystem);
    }, [currencySystem, storageReady]);

    useEffect(() => {
        if (!storageReady) return;
        window.localStorage.setItem("tankify-measurement", measurementSystem);
    }, [measurementSystem, storageReady]);

    useEffect(() => {
        if (!storageReady) return;
        window.localStorage.setItem("tankify-fuelType", fuelType);
    }, [fuelType, storageReady]);

    useEffect(() => {
        if (!storageReady) return;
        window.localStorage.setItem("tankify-debug-mode", debugMode ? "1" : "0");
    }, [debugMode, storageReady]);

    useEffect(() => {
        if (!storageReady) return;
        if (!debugAllowed && debugMode) setDebugMode(false);
    }, [debugAllowed, debugMode, storageReady]);

    useEffect(() => {
        if (!storageReady) return;
        window.localStorage.setItem(
            "tankify-inputs-v1",
            JSON.stringify({
                localPricePerLiter,
                destinationPricePerLiter,
                consumptionLPer100Km,
                tankSizeLiters,
                avgSpeedKmh,
            })
        );
    }, [
        localPricePerLiter,
        destinationPricePerLiter,
        consumptionLPer100Km,
        tankSizeLiters,
        avgSpeedKmh,
        storageReady,
    ]);

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

    const localPricePerGallon = pricePerLiterToPerGallon(localPricePerLiter);
    const destinationPricePerGallon = pricePerLiterToPerGallon(destinationPricePerLiter);
    const consumptionMpg = lPer100KmToMpg(consumptionLPer100Km);
    const tankSizeGallons = litersToGallons(tankSizeLiters);
    const avgSpeedMph = kmhToMph(avgSpeedKmh);

    const localPriceDisplay =
        measurementSystem === "metric" ? localPricePerLiter : localPricePerGallon;
    const destinationPriceDisplay =
        measurementSystem === "metric"
            ? destinationPricePerLiter
            : destinationPricePerGallon;
    const consumptionDisplay =
        measurementSystem === "metric" ? consumptionLPer100Km : consumptionMpg;
    const tankSizeDisplay =
        measurementSystem === "metric" ? tankSizeLiters : tankSizeGallons;
    const avgSpeedDisplay = measurementSystem === "metric" ? avgSpeedKmh : avgSpeedMph;

    const setLocalPrice = (value: number) => {
        setLocalPricePerLiter(
            measurementSystem === "metric" ? value : pricePerGallonToPerLiter(value)
        );
    };

    const setDestinationPrice = (value: number) => {
        setDestinationPricePerLiter(
            measurementSystem === "metric" ? value : pricePerGallonToPerLiter(value)
        );
    };

    const setConsumption = (value: number) => {
        setConsumptionLPer100Km(
            measurementSystem === "metric" ? value : mpgToLPer100Km(value)
        );
    };

    const setTankSize = (value: number) => {
        setTankSizeLiters(measurementSystem === "metric" ? value : gallonsToLiters(value));
    };

    const setAvgSpeed = (value: number) => {
        setAvgSpeedKmh(measurementSystem === "metric" ? value : mphToKmh(value));
    };

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
                setDraftStartPoint(point);
                setStartText(point.label);
            } else {
                setDraftEndPoint(point);
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

    function getCurrentPosition(): Promise<{ lat: number; lon: number }> {
        if (typeof window === "undefined") return Promise.reject(new Error("NO_WINDOW"));
        if (!window.isSecureContext) return Promise.reject(new Error("NOT_SECURE_CONTEXT"));
        if (!navigator.geolocation) return Promise.reject(new Error("NO_GEOLOCATION"));

        const tryOnce = (opts: PositionOptions) =>
            new Promise<{ lat: number; lon: number }>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                    (err) => reject(err),
                    opts
                );
            });

        // Some devices/timeouts are flaky with high accuracy; fall back to a more permissive request.
        return tryOnce({ enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }).catch(() =>
            tryOnce({ enableHighAccuracy: false, timeout: 25000, maximumAge: 30000 })
        );
    }

    function tryReadLastLocation(): { lat: number; lon: number } | null {
        try {
            const raw = window.localStorage.getItem("tankify-last-location");
            if (!raw) return null;
            const parsed = JSON.parse(raw) as Partial<{ lat: unknown; lon: unknown }>;
            const lat = typeof parsed.lat === "number" ? parsed.lat : Number.NaN;
            const lon = typeof parsed.lon === "number" ? parsed.lon : Number.NaN;
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
            return { lat, lon };
        } catch {
            return null;
        }
    }

    function writeLastLocation(loc: { lat: number; lon: number }) {
        try {
            window.localStorage.setItem(
                "tankify-last-location",
                JSON.stringify({ lat: loc.lat, lon: loc.lon, ts: Date.now() })
            );
        } catch {}
    }

    async function handleUseMyLocationAsStart() {
        const reqId = ++myLocationReqIdRef.current;
        try {
            setError("");

            // Instant feedback: use the last known location (if available) right away.
            const cached = tryReadLastLocation();
            if (cached) {
                const label = t.route.currentLocation;
                setDraftStartPoint({ lat: cached.lat, lon: cached.lon, label });
                setStartText(label);
                setMapPickMode(null);
            }

            const { lat, lon } = await getCurrentPosition();
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("INVALID_COORDS");
            if (reqId !== myLocationReqIdRef.current) return;

            const label = t.route.currentLocation;
            setDraftStartPoint({ lat, lon, label });
            setStartText(label);
            setMapPickMode(null);
            writeLastLocation({ lat, lon });
        } catch {
            // If we already applied a cached location, don't block the user with an error.
            if (reqId !== myLocationReqIdRef.current) return;
            if (tryReadLastLocation()) return;
            setError(t.errors.locationFailed);
        }
    }

    async function handleUseMyLocationAsDestination() {
        const reqId = ++myLocationReqIdRef.current;
        try {
            setError("");

            const cached = tryReadLastLocation();
            if (cached) {
                const label = t.route.currentLocation;
                setDraftEndPoint({ lat: cached.lat, lon: cached.lon, label });
                setEndText(label);
                setMapPickMode(null);
            }

            const { lat, lon } = await getCurrentPosition();
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("INVALID_COORDS");
            if (reqId !== myLocationReqIdRef.current) return;

            const label = t.route.currentLocation;
            setDraftEndPoint({ lat, lon, label });
            setEndText(label);
            setMapPickMode(null);
            writeLastLocation({ lat, lon });
        } catch {
            if (reqId !== myLocationReqIdRef.current) return;
            if (tryReadLastLocation()) return;
            setError(t.errors.locationFailed);
        }
    }

    useEffect(() => {
        function handleUserLocation(ev: Event) {
            const detail = (ev as CustomEvent<Partial<{ lat: unknown; lon: unknown }>>).detail;
            const lat = typeof detail?.lat === "number" ? detail.lat : Number.NaN;
            const lon = typeof detail?.lon === "number" ? detail.lon : Number.NaN;
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

            setUserLocation({ lat, lon });
            if (draftStartPoint) return;

            const label = t.route.currentLocation;
            setDraftStartPoint({ lat, lon, label });
            setStartText(label);
        }

        window.addEventListener("tankify:user-location", handleUserLocation);
        return () => window.removeEventListener("tankify:user-location", handleUserLocation);
    }, [draftStartPoint, t]);

    function handleSwapStartEnd() {
        setError("");
        setSearchLoading(null);

        setStartText(endText);
        setEndText(startText);

        setDraftStartPoint(draftEndPoint);
        setDraftEndPoint(draftStartPoint);

        // Prices are tied to "start/local" vs "destination/end", so swap them too.
        setLocalPricePerLiter(destinationPricePerLiter);
        setDestinationPricePerLiter(localPricePerLiter);

        setMapPickMode((prev) => (prev === "start" ? "end" : prev === "end" ? "start" : null));
    }

    function handleToggleStation(stationId: string) {
        setSelectedStationId((prev) => (prev === stationId ? null : stationId));
    }

    function handleStationsChange(stations: Station[]) {
        setStationsQueried(true);
        setVisibleStations(stations);
    }

    function handleSelectStationAsStart({
        point,
        price,
        station,
    }: {
        point: Point;
        price?: number | null;
        station: Station;
    }) {
        setDraftStartPoint(point);
        setStartText(point.label);

        if (price != null) {
            setLocalPricePerLiter(price);
        }

        setSelectedStationId(station.id);
    }

    function handleSelectStationAsDestination({
        point,
        price,
        station,
    }: {
        point: Point;
        price?: number | null;
        station: Station;
    }) {
        setDraftEndPoint(point);
        setEndText(point.label);

        if (price != null) {
            setDestinationPricePerLiter(price);
        }

        setSelectedStationId(station.id);
    }

    function pointsEqual(a: Point | null, b: Point | null): boolean {
        if (a === b) return true;
        if (!a || !b) return false;
        return (
            Math.abs(a.lat - b.lat) < 1e-7 &&
            Math.abs(a.lon - b.lon) < 1e-7
        );
    }

    const isDirty = useMemo(() => {
        return (
            !pointsEqual(draftStartPoint, calcStartPoint) ||
            !pointsEqual(draftEndPoint, calcEndPoint)
        );
    }, [draftStartPoint, draftEndPoint, calcStartPoint, calcEndPoint]);

    useEffect(() => {
        if (!selectedStationId) return;
        if (visibleStations.some((s) => s.id === selectedStationId)) return;
        setSelectedStationId(null);
    }, [visibleStations, selectedStationId]);

    const hasCommittedRoute = Boolean(
        routeRequestId > 0 && !isDirty && calcStartPoint && calcEndPoint
    );

    function handleCalculateRoute() {
        setError("");
        if (!draftStartPoint) {
            setError(t.errors.noStartFound);
            return;
        }
        if (!draftEndPoint) {
            setError(t.errors.noDestinationFound);
            return;
        }

        setCalcStartPoint(draftStartPoint);
        setCalcEndPoint(draftEndPoint);
        setRouteRequestId((v) => v + 1);
        setMapPickMode(null);
    }

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
                onUseMyLocationAsStart={handleUseMyLocationAsStart}
                onUseMyLocationAsDestination={handleUseMyLocationAsDestination}
                onSwapStartEnd={handleSwapStartEnd}
                searchLoading={searchLoading}
                mapPickMode={mapPickMode}
            />

            <PriceSection
                t={t}
                localPrice={localPriceDisplay}
                setLocalPrice={setLocalPrice}
                destinationPrice={destinationPriceDisplay}
                setDestinationPrice={setDestinationPrice}
                currencySystem={currencySystem}
                measurementSystem={measurementSystem}
            />

            <button
                type="button"
                onClick={handleCalculateRoute}
                disabled={!draftStartPoint || !draftEndPoint || routeLoading}
                className={
                    "w-full rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-95 " +
                    (!draftStartPoint || !draftEndPoint || routeLoading
                        ? "bg-gray-200 text-gray-500"
                        : "bg-black text-white hover:bg-gray-900")
                }
            >
                {routeLoading ? t.status.loading : t.actions.calculate}
            </button>

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
            <VehicleModal
                open={vehicleModalOpen}
                t={t}
                measurementSystem={measurementSystem}
                consumption={consumptionDisplay}
                setConsumption={setConsumption}
                tankSize={tankSizeDisplay}
                setTankSize={setTankSize}
                avgSpeed={avgSpeedDisplay}
                setAvgSpeed={setAvgSpeed}
                onConfirm={() => {
                    try {
                        window.localStorage.setItem("tankify-vehicle-onboarded-v1", "1");
                    } catch {}
                    setVehicleModalOpen(false);
                }}
            />

            <SettingsModal
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                t={t}
                language={language}
                setLanguage={setLanguage}
                debugAllowed={debugAllowed}
                debugMode={debugMode}
                setDebugMode={setDebugMode}
                fuelType={fuelType}
                setFuelType={setFuelType}
                currencySystem={currencySystem}
                setCurrencySystem={setCurrencySystem}
                measurementSystem={measurementSystem}
                setMeasurementSystem={setMeasurementSystem}
                consumption={consumptionDisplay}
                setConsumption={setConsumption}
                tankSize={tankSizeDisplay}
                setTankSize={setTankSize}
                avgSpeed={avgSpeedDisplay}
                setAvgSpeed={setAvgSpeed}
            />

            <main className="h-screen overflow-x-hidden bg-white md:bg-neutral-100">
                <div
                    className={
                        "mx-auto hidden p-4 lg:flex lg:flex-row lg:items-start w-full max-w-[1920px] h-full min-w-0 gap-6"
                    }
                >
                    <section className="self-start rounded-3xl bg-white p-6 shadow-sm flex-none w-105 h-full">
                        <div className="h-full overflow-auto">
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
                        </div>
                    </section>

                    <section className="flex-1 min-w-0 h-full flex flex-col gap-4">
                        <div
                            className={
                                "rounded-3xl bg-white shadow-sm overflow-hidden transition-[height] duration-300 ease-out grow"
                            }
                        >
                            <div className="h-full overflow-hidden rounded-3xl">
                                 <MapPicker
                                     start={draftStartPoint}
                                     end={draftEndPoint}
                                     routeGeometry={hasCommittedRoute ? routeData?.geometry ?? [] : []}
                                     pickMode={mapPickMode}
                                     fuelType={fuelType}
                                     measurementSystem={measurementSystem}
                                     debugMode={debugMode}
                                     t={t}
                                     defaultLocationEnabled
                                     onStationsChange={handleStationsChange}
                                     selectedStationId={selectedStationId}
                                     onStationSelect={(station) => setSelectedStationId(station.id)}
                                     onMapPick={(type, point) => {
                                         if (type === "start") {
                                             setDraftStartPoint(point);
                                             setStartText(point.label);
                                         } else {
                                             setDraftEndPoint(point);
                                             setEndText(point.label);
                                         }
                                         setMapPickMode(null);
                                     }}
                                 />
                             </div>
                         </div>

                        {hasCommittedRoute ? (
                        <div className="rounded-3xl bg-white p-5 shadow-sm h-auto max-h-full">
                            <div className="h-full overflow-auto">
                                <div className="flex flex-col gap-6">

                                    <WorthPanel
                                        t={t}
                                        currencySystem={currencySystem}
                                        profit={profit}
                                        netSaving={calculation.netSaving}
                                    />
                                    <div className="h-full rounded-2xl border border-gray-100 p-4">
                                        <ResultsPanel
                                            t={t}
                                            currencySystem={currencySystem}
                                            measurementSystem={measurementSystem}
                                            profit={profit}
                                            routeLoading={routeLoading}
                                            calculation={calculation}
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>
                        ) : null}
                    </section>

                            {stationsQueried ? (
                                    <StationsSidebar
                                        stations={visibleStations}
                                        selectedStationId={selectedStationId}
                                        onToggleStation={handleToggleStation}
                                        fuelType={fuelType}
                                        measurementSystem={measurementSystem}
                                        currencySystem={currencySystem}
                                        language={language}
                                        debugMode={debugMode}
                                        userLocation={userLocation}
                                        t={t}
                                        onSelectStationAsStart={handleSelectStationAsStart}
                                        onSelectStationAsDestination={handleSelectStationAsDestination}
                                    />

                            ) : null}
                </div>

                <div className="lg:hidden">
                    <div className="fixed inset-0 z-0 h-svh w-screen bg-white">
                        <MapPicker
                             start={draftStartPoint}
                             end={draftEndPoint}
                             routeGeometry={hasCommittedRoute ? routeData?.geometry ?? [] : []}
                             pickMode={mapPickMode}
                             fuelType={fuelType}
                             measurementSystem={measurementSystem}
                             debugMode={debugMode}
                             t={t}
                             defaultLocationEnabled
                             selectedStationId={selectedStationId}
                             onStationSelect={(station) => {
                                 setSelectedStationId(station.id);
                                 setBottomSheet(window.innerHeight * snapWorthMultiplicator);
                             }}
                             onMapPick={(type, point) => {
                                 if (type === "start") {
                                     setDraftStartPoint(point);
                                     setStartText(point.label);
                                } else {
                                    setDraftEndPoint(point);
                                    setEndText(point.label);
                                 }
                                 setMapPickMode(null);
                                 setBottomSheet(window.innerHeight*snapWorthMultiplicator);
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
                        showResults={hasCommittedRoute}
                        calculation={calculation}
                        profit={profit}
                    />
                </div>
            </main>
        </>
    );
}
