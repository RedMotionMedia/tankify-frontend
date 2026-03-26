"use client";

import Image from "next/image";
import React from "react";
import { TranslationSchema } from "@/config/i18n";
import {
    CurrencySystem,
    Language,
    MeasurementSystem,
    Point,
    Station,
} from "@/types/tankify";
import { eurToQuote } from "@/lib/fx";
import { kmToMiles, pricePerLiterToPerGallon } from "@/lib/units";

type UserLocation = { lat: number; lon: number };

function withCacheBuster(url: string, cacheBust: number): string {
    if (!url) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${cacheBust}`;
}

function getStationInitials(name: string | undefined): string {
    const value = (name ?? "").trim();
    if (!value) return "?";

    const parts = value.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "?";
    const second = parts[1]?.[0] ?? "";
    return (first + second).toUpperCase();
}

function formatDisplayPrice(
    valueEurPerLiter: number | null | undefined,
    measurementSystem: MeasurementSystem,
    currencySystem: CurrencySystem,
    eurToCurrencyRate: number
) {
    if (valueEurPerLiter === null || valueEurPerLiter === undefined) return "—";

    const perUnit =
        measurementSystem === "metric"
            ? valueEurPerLiter
            : pricePerLiterToPerGallon(valueEurPerLiter);
    const inCurrency = eurToQuote(perUnit, eurToCurrencyRate);

    const unit = measurementSystem === "metric" ? "/L" : "/gal";
    return `${inCurrency.toFixed(3)} ${currencySystem}${unit}`;
}

function haversineKm(a: UserLocation, b: { lat: number; lon: number }): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h =
        sinDLat * sinDLat +
        Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const WEEKDAY_ORDER = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"] as const;

function jsDayToEcontrolCode(jsDay: number): (typeof WEEKDAY_ORDER)[number] {
    if (jsDay === 0) return "SO";
    if (jsDay === 1) return "MO";
    if (jsDay === 2) return "DI";
    if (jsDay === 3) return "MI";
    if (jsDay === 4) return "DO";
    if (jsDay === 5) return "FR";
    return "SA";
}

function weekdayLabel(code: string, language: Language): string {
    const idx = WEEKDAY_ORDER.indexOf(code as (typeof WEEKDAY_ORDER)[number]);
    if (idx === -1) return code;

    // 2020-01-06 was a Monday; use UTC to avoid timezone drift.
    const d = new Date(Date.UTC(2020, 0, 6 + idx));
    const locale = language === "de" ? "de-AT" : "en-US";
    return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d);
}

function normalizeWebsiteUrl(url: string): string {
    return url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`;
}

function is24Hours(from: string | null, to: string | null): boolean {
    if (!from || !to) return false;
    if (from !== "00:00") return false;
    return to === "24:00" || to === "00:00";
}

export default function StationPopupContent({
    station,
    selectedPrice,
    measurementSystem,
    currencySystem,
    eurToCurrencyRate,
    language,
    debugMode,
    logoCacheBust,
    userLocation,
    t,
    onSelectStationAsStart,
    onSelectStationAsDestination,
}: {
    station: Station;
    selectedPrice: number | null | undefined; // EUR/L from E-Control
    measurementSystem: MeasurementSystem;
    currencySystem: CurrencySystem;
    eurToCurrencyRate: number;
    language: Language;
    debugMode: boolean;
    logoCacheBust: number;
    userLocation: UserLocation | null;
    t: TranslationSchema;
    onSelectStationAsStart: (payload: {
        point: Point;
        price?: number | null;
        station: Station;
    }) => void;
    onSelectStationAsDestination: (payload: {
        point: Point;
        price?: number | null;
        station: Station;
        autoCalculate?: boolean;
    }) => void;
}) {
    const initials = getStationInitials(station.brandName ?? station.name);
    const openingHours = Array.isArray(station.openingHours) ? station.openingHours : [];
    const logoUrl = station.logoUrl ? withCacheBuster(station.logoUrl, logoCacheBust) : null;

    const openingHoursByDay = new Map<string, Array<{ from: string | null; to: string | null }>>();
    for (const h of openingHours) {
        const day = String(h.day ?? "").trim();
        if (!day) continue;
        const list = openingHoursByDay.get(day) ?? [];
        list.push({ from: h.from ?? null, to: h.to ?? null });
        openingHoursByDay.set(day, list);
    }

    const today = jsDayToEcontrolCode(new Date().getDay());
    const todayIdx = WEEKDAY_ORDER.indexOf(today);
    const rotatedWeekdays =
        todayIdx === -1
            ? [...WEEKDAY_ORDER]
            : [...WEEKDAY_ORDER.slice(todayIdx), ...WEEKDAY_ORDER.slice(0, todayIdx)];

    const distanceKm = userLocation ? haversineKm(userLocation, station) : null;

    return (
        <div className="w-full max-w-[70vw] select-text">
            <div className="flex items-start gap-3">
                <div
                    className={
                        `relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 bg-white shadow-sm ${
                            selectedPrice != null ? "station-logo--ok" : "station-logo--missing"
                        }`
                    }
                >
                    <div className="absolute inset-0 grid place-items-center text-xs font-extrabold tracking-tight text-gray-700">
                        {initials}
                    </div>
                    {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={logoUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 h-full w-full rounded-full object-contain"
                            onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                        />
                    ) : null}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-extrabold tracking-tight text-gray-900">
                        {station.name}
                    </div>

                    <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                        {station.address ? <div>{station.address}</div> : null}
                        {station.postalCode || station.city ? (
                            <div className="text-gray-500">
                                {(station.postalCode ? `${station.postalCode} ` : "") +
                                    (station.city ?? "")}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
                {distanceKm != null ? (
                    <span className="rounded-full bg-gray-50 px-2 py-0.5 font-medium text-gray-600 ring-1 ring-gray-200">
                        {t.station.distance}:{" "}
                        {(measurementSystem === "imperial" ? kmToMiles(distanceKm) : distanceKm).toFixed(
                            2
                        )}{" "}
                        {measurementSystem === "imperial" ? t.units.miles : t.units.km}
                    </span>
                ) : null}

                <div className="flex-auto" />

                <span className="font-medium text-gray-500">{t.pricing.dataSource}</span>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 ring-1 ring-blue-200">
                    <Image
                        src="/resources/logos/econtrol.svg"
                        alt="E-Control"
                        width={47}
                        height={14}
                        className="h-3.5 w-auto"
                        loading="lazy"
                        unoptimized
                    />
                </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-gray-200 bg-linear-to-b from-gray-50 to-white p-3">
                    <div className="text-[11px] font-semibold text-gray-600">{t.pricing.diesel}</div>
                    <div className="mt-0.5 text-sm font-extrabold text-gray-900">
                        {formatDisplayPrice(station.diesel, measurementSystem, currencySystem, eurToCurrencyRate)}
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-linear-to-b from-gray-50 to-white p-3">
                    <div className="text-[11px] font-semibold text-gray-600">{t.pricing.super95}</div>
                    <div className="mt-0.5 text-sm font-extrabold text-gray-900">
                        {formatDisplayPrice(station.super95, measurementSystem, currencySystem, eurToCurrencyRate)}
                    </div>
                </div>
            </div>

            <div className="mt-3 space-y-2">
                <details className="group rounded-2xl border border-gray-200 bg-white px-3 py-2">
                    <summary className="flex list-none items-center gap-2 text-xs font-semibold text-gray-700">
                        <span
                            aria-hidden="true"
                            className="text-gray-500 transition-transform group-open:rotate-90"
                        >
                            ▶
                        </span>
                        <span className="flex-auto">{t.station.openingHours}</span>
                        <span className="text-[11px] font-medium inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 ring-1 ring-green-200 text-green-500">
                            {station.open === true
                                ? t.station.open
                                : station.open === false
                                    ? t.station.closed
                                    : t.station.unknown}
                        </span>
                    </summary>

                    {openingHours.length ? (
                        <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs text-gray-700">
                            {rotatedWeekdays.map((code) => {
                                const intervals = openingHoursByDay.get(code) ?? [];
                                const has24 = intervals.some((x) => is24Hours(x.from, x.to));
                                const value = has24
                                    ? t.station.open24Hours
                                    : intervals.length
                                        ? intervals
                                            .map((x) => (x.from && x.to ? `${x.from}\u2013${x.to}` : "—"))
                                            .join(", ")
                                        : "—";

                                const isToday = code === today;

                                return (
                                    <React.Fragment key={code}>
                                        <div className={isToday ? "font-bold text-gray-900" : "text-gray-600"}>
                                            {weekdayLabel(code, language)}
                                        </div>
                                        <div
                                            className={
                                                "text-right tabular-nums " +
                                                (isToday ? "font-bold text-gray-900" : "")
                                            }
                                        >
                                            {value}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-gray-500">—</div>
                    )}
                </details>

                <details className="group rounded-2xl border border-gray-200 bg-white px-3 py-2">
                    <summary className="flex list-none items-center gap-2 text-xs font-semibold text-gray-700">
                        <span
                            aria-hidden="true"
                            className="text-gray-500 transition-transform group-open:rotate-90"
                        >
                            ▶
                        </span>
                        <span className="flex-auto">{t.station.contact}</span>
                    </summary>

                    {station.contact ? (
                        <div className="mt-2 space-y-1 text-xs text-gray-700">
                            {station.contact?.telephone ? (
                                <div>
                                    <span className="font-medium">{t.station.phone}:</span>{" "}
                                    <a href={`tel:${station.contact.telephone}`} className="underline">
                                        {station.contact.telephone}
                                    </a>
                                </div>
                            ) : null}
                            {station.contact?.fax ? (
                                <div>
                                    <span className="font-medium">{t.station.fax}:</span>{" "}
                                    <span className="tabular-nums">{station.contact.fax}</span>
                                </div>
                            ) : null}
                            {station.contact?.mail ? (
                                <div>
                                    <span className="font-medium">{t.station.mail}:</span>{" "}
                                    <a href={`mailto:${station.contact.mail}`} className="underline">
                                        {station.contact.mail}
                                    </a>
                                </div>
                            ) : null}
                            {station.contact?.website ? (
                                <div>
                                    <span className="font-medium">{t.station.website}:</span>{" "}
                                    <a
                                        href={normalizeWebsiteUrl(station.contact.website)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="underline"
                                    >
                                        {station.contact.website}
                                    </a>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-gray-500">—</div>
                    )}
                </details>

                {station.otherServiceOffers ? (
                    <details className="group rounded-2xl border border-gray-200 bg-white px-3 py-2">
                        <summary className="flex list-none items-center gap-2 text-xs font-semibold text-gray-700">
                            <span
                                aria-hidden="true"
                                className="text-gray-500 transition-transform group-open:rotate-90"
                            >
                                ▶
                            </span>
                            <span className="flex-auto">{t.station.otherOffers}</span>
                        </summary>
                        <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-2 text-[11px] leading-snug text-gray-700">
                            {station.otherServiceOffers}
                        </pre>
                    </details>
                ) : null}

                {debugMode && station ? (
                    <details className="group rounded-2xl border border-gray-200 bg-white px-3 py-2">
                        <summary className="flex list-none items-center gap-2 text-xs font-semibold text-gray-700">
                            <span
                                aria-hidden="true"
                                className="text-gray-500 transition-transform group-open:rotate-90"
                            >
                                ▶
                            </span>
                            <span className="flex-auto">{t.station.rawData}</span>
                        </summary>
                        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-2 text-[11px] leading-snug text-gray-700">
                            {JSON.stringify(station, null, 2)}
                        </pre>
                    </details>
                ) : null}
            </div>

            <div className="mt-3 grid gap-2">
                <button
                    type="button"
                    onClick={() =>
                        onSelectStationAsStart({
                            point: { lat: station.lat, lon: station.lon, label: station.name },
                            price: selectedPrice,
                            station,
                        })
                    }
                    className="w-full rounded-2xl bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
                >
                    {t.route.setAsStart}
                </button>

                <button
                    type="button"
                    onClick={() =>
                        onSelectStationAsDestination({
                            point: { lat: station.lat, lon: station.lon, label: station.name },
                            price: selectedPrice,
                            station,
                            autoCalculate: true,
                        })
                    }
                    className="w-full rounded-2xl bg-black px-3 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
                >
                    {t.route.setAsDestination}
                </button>
            </div>
        </div>
    );
}
