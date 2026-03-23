"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
});

type Point = {
  lat: number;
  lon: number;
  label: string;
};

type FuelType = "diesel" | "super95";

type GeocodeResult = {
  display_name: string;
  lat: string;
  lon: string;
};

type RouteData = {
  distanceKm: number;
  durationHours: number;
  geometry: [number, number][];
};

const DEFAULT_START: Point = {
  lat: 48.3069,
  lon: 14.2858,
  label: "Linz",
};

const DEFAULT_END: Point = {
  lat: 48.6156,
  lon: 14.3111,
  label: "Vyšší Brod",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatDuration(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatInputValue(value: number, step: number) {
  if (step >= 1) return value.toFixed(0);
  if (step >= 0.1) return value.toFixed(1);
  return value.toFixed(3);
}

function getProfitLevel(netSaving: number) {
  if (netSaving < 0) {
    return {
      label: "Lohnt sich nicht",
      colorClass: "text-red-600",
      bgClass: "bg-red-50",
      percent: 10,
    };
  }

  if (netSaving < 5) {
    return {
      label: "Knapp lohnend",
      colorClass: "text-yellow-600",
      bgClass: "bg-yellow-50",
      percent: 40,
    };
  }

  if (netSaving < 15) {
    return {
      label: "Lohnend",
      colorClass: "text-lime-600",
      bgClass: "bg-lime-50",
      percent: 70,
    };
  }

  return {
    label: "Sehr lohnend",
    colorClass: "text-green-600",
    bgClass: "bg-green-50",
    percent: 100,
  };
}

async function fetchRoute(start: Point, end: Point): Promise<RouteData | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;

  const res = await fetch(url);

  if (!res.ok) return null;

  const data = await res.json();

  if (!data.routes || !data.routes.length) return null;

  const route = data.routes[0];

  return {
    distanceKm: route.distance / 1000,
    durationHours: route.duration / 3600,
    geometry: route.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]]
    ),
  };
}

export default function Page() {
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

  const [searchLoading, setSearchLoading] = useState<"start" | "end" | null>(
      null
  );
  const [error, setError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(null);

  const [mapPickMode, setMapPickMode] = useState<"start" | "end" | null>(null);

  async function geocode(query: string): Promise<Point | null> {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(
        query
    )}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error("Adresssuche fehlgeschlagen.");
    }

    const data: GeocodeResult[] = await res.json();

    if (!data.length) return null;

    return {
      lat: Number(data[0].lat),
      lon: Number(data[0].lon),
      label: data[0].display_name,
    };
  }

  async function handleSearch(type: "start" | "end") {
    try {
      setError("");
      setSearchLoading(type);

      const query = type === "start" ? startText : endText;
      const point = await geocode(query);

      if (!point) {
        setError(`Kein Ergebnis für ${type === "start" ? "Start" : "Ziel"} gefunden.`);
        return;
      }

      if (type === "start") {
        setStartPoint(point);
        setStartText(point.label);
      } else {
        setEndPoint(point);
        setEndText(point.label);
      }
    } catch {
      setError("Suche fehlgeschlagen. Bitte später erneut probieren.");
    } finally {
      setSearchLoading(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadRoute() {
      setRouteLoading(true);
      setError("");

      try {
        const route = await fetchRoute(startPoint, endPoint);

        if (!cancelled) {
          if (route) {
            setRouteData(route);
          } else {
            setError("Route konnte nicht berechnet werden.");
            setRouteData(null);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Route konnte nicht geladen werden.");
          setRouteData(null);
        }
      } finally {
        if (!cancelled) {
          setRouteLoading(false);
        }
      }
    }

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [startPoint, endPoint]);

  const oneWayKm = routeData?.distanceKm ?? 0;
  const roundTripKm = oneWayKm * 2;

  const estimatedHoursOneWay =
      routeData?.durationHours ?? (avgSpeed > 0 ? oneWayKm / avgSpeed : 0);
  const estimatedHoursRoundTrip = estimatedHoursOneWay * 2;

  const tripLiters = (roundTripKm / 100) * consumption;
  const tripCost = tripLiters * destinationPrice;

  const priceDifference = localPrice - destinationPrice;
  const grossSavingFullTank = tankSize * priceDifference;
  const netSaving = grossSavingFullTank - tripCost;

  const breakEvenDiff = tankSize > 0 ? tripCost / tankSize : 0;

  const maxConsumption =
      roundTripKm > 0 && destinationPrice > 0
          ? (tankSize * priceDifference) / ((roundTripKm / 100) * destinationPrice)
          : 0;

  const profit = useMemo(() => getProfitLevel(netSaving), [netSaving]);

  return (
      <main className="min-h-screen bg-neutral-100 p-4 md:p-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-bold">Tankify</h1>
            <p className="mt-2 text-sm text-gray-600">
              Berechnet, ob sich die Fahrt zum günstigeren Tanken lohnt.
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Kraftstoff
                </label>
                <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value as FuelType)}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none"
                >
                  <option value="diesel">Diesel</option>
                  <option value="super95">Benzin</option>
                </select>
              </div>

              <LocationField
                  label="Startpunkt"
                  value={startText}
                  onChange={setStartText}
                  onSearch={() => handleSearch("start")}
                  onPickOnMap={() => setMapPickMode("start")}
                  loading={searchLoading === "start"}
                  pickActive={mapPickMode === "start"}
              />

              <LocationField
                  label="Zielort"
                  value={endText}
                  onChange={setEndText}
                  onSearch={() => handleSearch("end")}
                  onPickOnMap={() => setMapPickMode("end")}
                  loading={searchLoading === "end"}
                  pickActive={mapPickMode === "end"}
              />

              <SliderNumberField
                  label="Spritpreis zuhause"
                  min={1}
                  max={3}
                  step={0.001}
                  value={localPrice}
                  onChange={setLocalPrice}
                  unit="€/L"
              />

              <SliderNumberField
                  label="Spritpreis am Ziel"
                  min={1}
                  max={3}
                  step={0.001}
                  value={destinationPrice}
                  onChange={setDestinationPrice}
                  unit="€/L"
              />

              <SliderNumberField
                  label="Verbrauch"
                  min={3}
                  max={25}
                  step={0.1}
                  value={consumption}
                  onChange={setConsumption}
                  unit="L / 100 km"
              />

              <SliderNumberField
                  label="Tankgröße"
                  min={20}
                  max={120}
                  step={1}
                  value={tankSize}
                  onChange={setTankSize}
                  unit="L"
              />

              <SliderNumberField
                  label="Ø Geschwindigkeit"
                  min={30}
                  max={130}
                  step={1}
                  value={avgSpeed}
                  onChange={setAvgSpeed}
                  unit="km/h"
              />

              {mapPickMode ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    Klicke jetzt auf die Karte, um{" "}
                    {mapPickMode === "start" ? "den Startpunkt" : "den Zielort"} zu
                    setzen.
                  </div>
              ) : null}

              {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-6">
            <div className="h-80 overflow-hidden rounded-3xl bg-white shadow-sm md:h-105">
              <MapPicker
                  start={startPoint}
                  end={endPoint}
                  routeGeometry={routeData?.geometry ?? []}
                  pickMode={mapPickMode}
                  fuelType={fuelType}
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
                  onSelectStationAsDestination={({ point, price }) => {
                    setEndPoint(point);
                    setEndText(point.label);

                    if (price !== null && price !== undefined) {
                      setDestinationPrice(price);
                    }
                  }}
              />
            </div>

            <div className={`rounded-3xl p-5 shadow-sm ${profit.bgClass}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Netto-Ersparnis</span>
                <span className={`text-sm font-semibold ${profit.colorClass}`}>
                {profit.label}
              </span>
              </div>

              <div className={`mt-2 text-3xl font-bold ${profit.colorClass}`}>
                {formatCurrency(netSaving)}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">Lohnt sich Skala</span>
                <span className={`text-sm font-semibold ${profit.colorClass}`}>
                {profit.label}
              </span>
              </div>

              <div className="relative pt-2 pb-8">
                <div className="h-4 rounded-full bg-linear-to-r from-red-500 via-yellow-400 to-green-500" />

                <div
                    className="absolute bottom-0 -translate-x-1/2 text-lg leading-none"
                    style={{ left: `${profit.percent}%` }}
                >
                  ▲
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Je weiter rechts, desto stärker lohnt sich die Fahrt.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                  title="Einfache Strecke"
                  value={routeLoading ? "Lade..." : `${oneWayKm.toFixed(1)} km`}
              />
              <StatCard
                  title="Hin & retour"
                  value={routeLoading ? "Lade..." : `${roundTripKm.toFixed(1)} km`}
              />
              <StatCard
                  title="Preisunterschied"
                  value={`${priceDifference.toFixed(3)} €/L`}
              />
              <StatCard title="Fahrtkosten" value={formatCurrency(tripCost)} />
              <StatCard
                  title="Fahrzeit einfach"
                  value={routeLoading ? "Lade..." : formatDuration(estimatedHoursOneWay)}
              />
              <StatCard
                  title="Fahrzeit gesamt"
                  value={routeLoading ? "Lade..." : formatDuration(estimatedHoursRoundTrip)}
              />
              <StatCard
                  title="Ersparnis bei vollem Tank"
                  value={formatCurrency(grossSavingFullTank)}
              />
              <StatCard
                  title="Netto-Ersparnis"
                  value={formatCurrency(netSaving)}
                  valueClassName={profit.colorClass}
              />
              <StatCard
                  title="Break-even Unterschied"
                  value={`${(breakEvenDiff * 100).toFixed(1)} Cent/L`}
              />
              <StatCard
                  title="Max. Verbrauch"
                  value={`${maxConsumption.toFixed(1)} L / 100 km`}
              />
            </div>
          </section>
        </div>
      </main>
  );
}

function StatCard({
                    title,
                    value,
                    valueClassName = "text-gray-900",
                  }: {
  title: string;
  value: string;
  valueClassName?: string;
}) {
  return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-sm text-gray-500">{title}</div>
        <div className={`mt-2 text-2xl font-bold ${valueClassName}`}>{value}</div>
      </div>
  );
}

function SliderNumberField({
                             label,
                             min,
                             max,
                             step,
                             value,
                             onChange,
                             unit,
                           }: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  unit: string;
}) {
  return (
      <div>
        <label className="mb-2 block text-sm font-medium">
          {label}: {formatInputValue(value, step)} {unit}
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full"
          />

          <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={Number(formatInputValue(value, step))}
              onChange={(e) =>
                  onChange(clamp(Number(e.target.value || 0), min, max))
              }
              className="w-full rounded-xl border border-gray-300 px-3 py-2 sm:w-28"
          />
        </div>
      </div>
  );
}

function LocationField({
                         label,
                         value,
                         onChange,
                         onSearch,
                         onPickOnMap,
                         loading,
                         pickActive,
                       }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  onPickOnMap: () => void;
  loading: boolean;
  pickActive: boolean;
}) {
  return (
      <div>
        <label className="mb-2 block text-sm font-medium">{label}</label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none"
          />
          <button
              onClick={onSearch}
              className="rounded-2xl bg-black px-4 py-3 text-white"
          >
            {loading ? "..." : "Suchen"}
          </button>
          <button
              onClick={onPickOnMap}
              className={`rounded-2xl px-4 py-3 text-white ${
                  pickActive ? "bg-blue-600" : "bg-gray-700"
              }`}
          >
            Karte
          </button>
        </div>
      </div>
  );
}