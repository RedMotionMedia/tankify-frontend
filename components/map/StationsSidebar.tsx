"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { TranslationSchema } from "@/config/i18n";
import {
    CurrencySystem,
    FuelType,
    Language,
    MeasurementSystem,
    Point,
    Station,
} from "@/types/tankify";
import { eurToQuote } from "@/lib/fx";
import { pricePerLiterToPerGallon } from "@/lib/units";
import StationPopupContent from "@/components/map/StationPopupContent";

function formatPrice(
    valueEurPerLiter: number | null | undefined,
    measurementSystem: MeasurementSystem,
    currencySystem: CurrencySystem,
    eurToCurrencyRate: number
): string {
    if (valueEurPerLiter === null || valueEurPerLiter === undefined) return "-";

    const perUnit =
        measurementSystem === "metric"
            ? valueEurPerLiter
            : pricePerLiterToPerGallon(valueEurPerLiter);
    const inCurrency = eurToQuote(perUnit, eurToCurrencyRate);
    const unit = measurementSystem === "metric" ? "/L" : "/gal";

    return `${inCurrency.toFixed(3)} ${currencySystem}${unit}`;
}

export default function StationsSidebar({
    stations,
    selectedStationId,
    onToggleStation,
    fuelType,
    measurementSystem,
    currencySystem,
    eurToCurrencyRate,
    language,
    debugMode,
    userLocation,
    t,
    onSelectStationAsStart,
    onSelectStationAsDestination,
    onClose,
}: {
    stations: Station[];
    selectedStationId: string | null;
    onToggleStation: (stationId: string) => void;
    fuelType: FuelType;
    measurementSystem: MeasurementSystem;
    currencySystem: CurrencySystem;
    eurToCurrencyRate: number;
    language: Language;
    debugMode: boolean;
    userLocation: { lat: number; lon: number } | null;
    t: TranslationSchema;
    onSelectStationAsStart: (payload: { point: Point; price?: number | null; station: Station }) => void;
    onSelectStationAsDestination: (payload: {
        point: Point;
        price?: number | null;
        station: Station;
        autoCalculate?: boolean;
    }) => void;
    onClose?: () => void;
}) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [logoCacheBust, setLogoCacheBust] = useState(0);
    type SortDir = "off" | "asc" | "desc";
    const [priceSort, setPriceSort] = useState<SortDir>("off");
    const [distanceSort, setDistanceSort] = useState<SortDir>("off");
    const [openFirst, setOpenFirst] = useState(false);

    useEffect(() => {
        function handleLogoCacheCleared() {
            setLogoCacheBust((v) => v + 1);
        }
        window.addEventListener("tankify:logo-cache-cleared", handleLogoCacheCleared);
        return () =>
            window.removeEventListener("tankify:logo-cache-cleared", handleLogoCacheCleared);
    }, []);

    useEffect(() => {
        if (!selectedStationId) return;
        const node = document.getElementById(`station-row-${selectedStationId}`);
        if (!node) return;
        try {
            node.scrollIntoView({ block: "nearest" });
        } catch {}
    }, [selectedStationId]);

    const hasDistanceData = useMemo(() => {
        if (!userLocation) return false;
        return stations.some((s) => typeof s.distanceKm === "number" && Number.isFinite(s.distanceKm));
    }, [stations, userLocation]);

    const sortedStations = useMemo(() => {
        const effectiveDistanceSort: SortDir = hasDistanceData ? distanceSort : "off";

        const getPriceEur = (s: Station): number | null => {
            const v = fuelType === "diesel" ? s.diesel : s.super95;
            return typeof v === "number" && Number.isFinite(v) ? v : null;
        };

        const getDistanceKm = (s: Station): number | null => {
            const v = s.distanceKm;
            return typeof v === "number" && Number.isFinite(v) ? v : null;
        };

        const indexed = stations.map((s, idx) => ({ s, idx }));
        indexed.sort((a, b) => {
            if (openFirst) {
                const ao = a.s.open === true;
                const bo = b.s.open === true;
                if (ao !== bo) return ao ? -1 : 1;
            }

            if (priceSort !== "off") {
                const ap = getPriceEur(a.s);
                const bp = getPriceEur(b.s);
                if (ap === null && bp !== null) return 1;
                if (ap !== null && bp === null) return -1;
                if (ap !== null && bp !== null && ap !== bp) {
                    const dir = priceSort === "asc" ? 1 : -1;
                    return (ap - bp) * dir;
                }
            }

            if (effectiveDistanceSort !== "off") {
                const ad = getDistanceKm(a.s);
                const bd = getDistanceKm(b.s);
                if (ad === null && bd !== null) return 1;
                if (ad !== null && bd === null) return -1;
                if (ad !== null && bd !== null && ad !== bd) {
                    const dir = effectiveDistanceSort === "asc" ? 1 : -1;
                    return (ad - bd) * dir;
                }
            }

            return a.idx - b.idx;
        });

        return indexed.map((x) => x.s);
    }, [stations, fuelType, priceSort, distanceSort, hasDistanceData, openFirst]);

    const cycleSort = (dir: SortDir): SortDir => {
        if (dir === "off") return "asc";
        if (dir === "asc") return "desc";
        return "off";
    };

    const sortBadge = (dir: SortDir): string => {
        if (dir === "asc") return "^";
        if (dir === "desc") return "|";
        return "-";
    };

    return (
        <div className="self-start flex flex-col max-h-full min-h-0 rounded-3xl bg-white shadow-sm w-full">
            <div className="flex items-center gap-3 border-b border-gray-100 pt-5 pb-3 pr-5">
                {onClose ? (
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-10 w-10 place-items-center rounded-r-full bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95"
                        aria-label={t.actions.close}
                        title={t.actions.close}
                    >
                        <svg viewBox="0 0 20 20" className="h-6 w-6" aria-hidden="true">
                            <path
                                d="M7.5 5l5 5-5 5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                ) : null}
                <div className="w-auto">
                    <div className="text-sm font-semibold text-gray-900">Tankstellen</div>
                    <div className="text-xs text-gray-500">
                        {sortedStations.length > 0
                            ? `${sortedStations.length} ${t.route.stationsLoaded}`
                            : t.route.noStationsFound}
                    </div>
                </div>
            </div>

            <div className="flex flex-row items-center gap-2 p-2">
                <button
                    type="button"
                    onClick={() => setOpenFirst((v) => !v)}
                    className={
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 " +
                        (openFirst
                            ? "border-green-200 bg-green-50 text-green-500"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50")
                    }
                    title="Geoeffnet zuerst"
                    aria-pressed={openFirst}
                >
                    {t.station.open}
                </button>

                <button
                    type="button"
                    onClick={() => setPriceSort((v) => cycleSort(v))}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95"
                    title="Preis sortieren"
                    aria-label="Preis sortieren"
                >

                    <span className="text-[11px]">{sortBadge(priceSort)}</span>
                    Preis
                </button>

                <button
                    type="button"
                    onClick={() => setDistanceSort((v) => cycleSort(v))}
                    disabled={!hasDistanceData}
                    className={
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 " +
                        (hasDistanceData
                            ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                            : "border-gray-200 bg-white text-gray-400 opacity-60")
                    }
                    title={hasDistanceData ? "Distanz sortieren" : "Distanz nur mit Standort verfuegbar"}
                    aria-label="Distanz sortieren"
                >
                    <span className="text-[11px]">{sortBadge(hasDistanceData ? distanceSort : "off")}</span>
                    {t.station.distance}
                </button>
            </div>

            <div className="min-h-0 flex-1 pb-5 flex flex-col">
                <div className="min-h-0 flex-1 overflow-auto px-5 pt-5">
                    <div ref={scrollRef} className="min-h-0 space-y-3">
                        {sortedStations.map((station) => {
                            const isOpen = station.id === selectedStationId;
                            const priceEur = fuelType === "diesel" ? station.diesel : station.super95;
                            const deemphasize = openFirst && station.open !== true;

                            return (
                                <div
                                    key={station.id}
                                    id={`station-row-${station.id}`}
                                    className={
                                        "rounded-2xl border p-4 transition " +
                                        (isOpen
                                            ? "border-blue-200 bg-blue-50/30"
                                            : "border-gray-100 bg-white hover:bg-gray-50")
                                    }
                                    style={deemphasize ? { opacity: 0.55 } : undefined}
                                >
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 text-left"
                                        onClick={() => onToggleStation(station.id)}
                                    >
                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white">
                                            {station.logoUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={station.logoUrl}
                                                    alt=""
                                                    referrerPolicy="no-referrer"
                                                    className="h-full w-full object-contain"
                                                    onError={(e) => {
                                                        (e.currentTarget as HTMLImageElement).style.display =
                                                            "none";
                                                    }}
                                                />
                                            ) : (
                                                <div className="grid h-full w-full place-items-center text-xs font-bold text-gray-600">
                                                    {station.name.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold text-gray-900">
                                                {station.name}
                                            </div>
                                            <div className="truncate text-xs text-gray-500">
                                                {[station.postalCode, station.city].filter(Boolean).join(" ")}
                                            </div>
                                        </div>

                                        <div className="shrink-0 text-right">
                                            <div className="text-sm font-semibold text-gray-900">
                                                {formatPrice(
                                                    priceEur,
                                                    measurementSystem,
                                                    currencySystem,
                                                    eurToCurrencyRate
                                                )}
                                            </div>
                                        </div>
                                    </button>

                                    {isOpen ? (
                                        <div className="mt-3 border-t border-blue-100 pt-3">
                                            <StationPopupContent
                                                station={station}
                                                selectedPrice={priceEur}
                                                measurementSystem={measurementSystem}
                                                currencySystem={currencySystem}
                                                eurToCurrencyRate={eurToCurrencyRate}
                                                language={language}
                                                debugMode={debugMode}
                                                logoCacheBust={logoCacheBust}
                                                userLocation={userLocation}
                                                t={t}
                                                onSelectStationAsStart={onSelectStationAsStart}
                                                onSelectStationAsDestination={onSelectStationAsDestination}
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
