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
import { pricePerLiterToPerGallon } from "@/lib/units";
import StationPopupContent from "@/components/map/StationPopupContent";

type UserLocation = { lat: number; lon: number };

function formatPrice(
    value: number | null | undefined,
    measurementSystem: MeasurementSystem,
    currencySystem: CurrencySystem
): string {
    if (value === null || value === undefined) return "-";
    const converted =
        measurementSystem === "metric" ? value : pricePerLiterToPerGallon(value);
    const ccy = currencySystem === "eur" ? "EUR" : "USD";
    const unit = measurementSystem === "metric" ? "/L" : "/gal";
    return `${converted.toFixed(3)} ${ccy}${unit}`;
}

export default function StationsSidebar({
    stations,
    selectedStationId,
    onToggleStation,
    fuelType,
    measurementSystem,
    currencySystem,
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
    language: Language;
    debugMode: boolean;
    userLocation: UserLocation | null;
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

    const sortedStations = useMemo(() => {
        // Preserve backend sort order; just return a stable reference.
        return stations;
    }, [stations]);

    return (
        <div className="self-start flex flex-col max-h-full min-h-0 rounded-3xl bg-white shadow-sm w-full">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                <div>
                    <div className="text-sm font-semibold text-gray-900">Tankstellen</div>
                    <div className="text-xs text-gray-500">
                        {sortedStations.length > 0
                            ? `${sortedStations.length} ${t.route.stationsLoaded}`
                            : t.route.noStationsFound}
                    </div>
                </div>
                {onClose ? (
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95"
                        aria-label={t.actions.close}
                        title={t.actions.close}
                    >
                        X
                    </button>
                ) : null}
            </div>

            {/* Inset the scroll container from the bottom so the scrollbar doesn't touch the panel edge. */}
            <div className="min-h-0 flex-1 pb-5 flex flex-col">
                <div className="min-h-0 flex-1 overflow-auto px-5 pt-5">
                    {/* Keep scrollbars at the container edge, while content keeps consistent padding. */}
                    <div ref={scrollRef} className="min-h-0 space-y-3">
                        {sortedStations.map((station) => {
                            const isOpen = station.id === selectedStationId;
                            const price = fuelType === "diesel" ? station.diesel : station.super95;

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
                                            {formatPrice(price, measurementSystem, currencySystem)}
                                        </div>
                                    </div>
                                </button>

                                {isOpen ? (
                                    <div className="mt-3 border-t border-blue-100 pt-3">
                                        <StationPopupContent
                                            station={station}
                                            selectedPrice={price}
                                            measurementSystem={measurementSystem}
                                            currencySystem={currencySystem}
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
