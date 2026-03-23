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

type GeocodeResult = {
  display_name: string;
  lat: string;
  lon: string;
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

function haversineKm(a: Point, b: Point) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * y;
}

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

export default function Page() {
  const [startText, setStartText] = useState("Linz");
  const [endText, setEndText] = useState("Vyšší Brod");

  const [startPoint, setStartPoint] = useState<Point>(DEFAULT_START);
  const [endPoint, setEndPoint] = useState<Point>(DEFAULT_END);

  const [localPrice, setLocalPrice] = useState(2.142);
  const [destinationPrice, setDestinationPrice] = useState(1.585);
  const [consumption, setConsumption] = useState(5.0);
  const [tankSize, setTankSize] = useState(45);
  const [avgSpeed, setAvgSpeed] = useState(70);

  const [searchLoading, setSearchLoading] = useState<"start" | "end" | null>(
      null
  );
  const [error, setError] = useState("");

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
    } catch (e) {
      setError("Suche fehlgeschlagen. Bitte später erneut probieren.");
    } finally {
      setSearchLoading(null);
    }
  }

  const oneWayKm = useMemo(() => {
    return haversineKm(startPoint, endPoint);
  }, [startPoint, endPoint]);

  const roundTripKm = oneWayKm * 2;
  const tripLiters = (roundTripKm / 100) * consumption;
  const tripCost = tripLiters * destinationPrice;

  const priceDifference = localPrice - destinationPrice;
  const grossSavingFullTank = tankSize * priceDifference;
  const netSaving = grossSavingFullTank - tripCost;

  const estimatedHoursOneWay = oneWayKm / avgSpeed;
  const estimatedHoursRoundTrip = roundTripKm / avgSpeed;

  const breakEvenDiff = tripCost / tankSize;
  const maxConsumption =
      roundTripKm > 0
          ? (tankSize * priceDifference) / ((roundTripKm / 100) * destinationPrice)
          : 0;

  useEffect(() => {
    setError("");
  }, [localPrice, destinationPrice, consumption, tankSize, avgSpeed]);

  return (
      <main className="min-h-screen p-6 md:p-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-bold">Tank Trip Calculator</h1>
            <p className="mt-2 text-sm text-gray-600">
              Berechnet, ob sich die Fahrt zum günstigeren Tanken lohnt.
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">Startpunkt</label>
                <div className="flex gap-2">
                  <input
                      value={startText}
                      onChange={(e) => setStartText(e.target.value)}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none"
                      placeholder="z. B. Linz"
                  />
                  <button
                      onClick={() => handleSearch("start")}
                      className="rounded-2xl bg-black px-4 py-3 text-white"
                  >
                    {searchLoading === "start" ? "..." : "Suchen"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Zielort</label>
                <div className="flex gap-2">
                  <input
                      value={endText}
                      onChange={(e) => setEndText(e.target.value)}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none"
                      placeholder="z. B. Vyšší Brod"
                  />
                  <button
                      onClick={() => handleSearch("end")}
                      className="rounded-2xl bg-black px-4 py-3 text-white"
                  >
                    {searchLoading === "end" ? "..." : "Suchen"}
                  </button>
                </div>
              </div>

              <SliderField
                  label={`Spritpreis zuhause: ${localPrice.toFixed(3)} €/L`}
                  min={1}
                  max={3}
                  step={0.001}
                  value={localPrice}
                  onChange={setLocalPrice}
              />

              <SliderField
                  label={`Spritpreis am Ziel: ${destinationPrice.toFixed(3)} €/L`}
                  min={1}
                  max={3}
                  step={0.001}
                  value={destinationPrice}
                  onChange={setDestinationPrice}
              />

              <SliderField
                  label={`Verbrauch: ${consumption.toFixed(1)} L / 100 km`}
                  min={3}
                  max={20}
                  step={0.1}
                  value={consumption}
                  onChange={setConsumption}
              />

              <SliderField
                  label={`Tankgröße: ${tankSize.toFixed(0)} L`}
                  min={20}
                  max={120}
                  step={1}
                  value={tankSize}
                  onChange={setTankSize}
              />

              <SliderField
                  label={`Ø Geschwindigkeit: ${avgSpeed.toFixed(0)} km/h`}
                  min={30}
                  max={130}
                  step={1}
                  value={avgSpeed}
                  onChange={setAvgSpeed}
              />

              {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-6">
            <div className="h-[420px] overflow-hidden rounded-3xl bg-white shadow-sm">
              <MapPicker
                  start={startPoint}
                  end={endPoint}
                  onSelectStart={(point) => {
                    setStartPoint(point);
                    setStartText(point.label);
                  }}
                  onSelectEnd={(point) => {
                    setEndPoint(point);
                    setEndText(point.label);
                  }}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <StatCard title="Einfache Strecke" value={`${oneWayKm.toFixed(1)} km`} />
              <StatCard title="Hin & retour" value={`${roundTripKm.toFixed(1)} km`} />
              <StatCard title="Preisunterschied" value={`${priceDifference.toFixed(3)} €/L`} />
              <StatCard title="Fahrtkosten" value={formatCurrency(tripCost)} />
              <StatCard
                  title="Fahrzeit einfach"
                  value={formatDuration(estimatedHoursOneWay)}
              />
              <StatCard
                  title="Fahrzeit gesamt"
                  value={formatDuration(estimatedHoursRoundTrip)}
              />
              <StatCard
                  title="Ersparnis bei vollem Tank"
                  value={formatCurrency(grossSavingFullTank)}
              />
              <StatCard title="Netto-Ersparnis" value={formatCurrency(netSaving)} />
              <StatCard
                  title="Break-even Unterschied"
                  value={`${(breakEvenDiff * 100).toFixed(1)} Cent/L`}
              />
              <StatCard
                  title="Max. Verbrauch"
                  value={`${maxConsumption.toFixed(1)} L / 100 km`}
              />
            </div>

            <div
                className={`rounded-3xl p-6 shadow-sm ${
                    netSaving >= 0
                        ? "bg-emerald-50 text-emerald-900"
                        : "bg-red-50 text-red-900"
                }`}
            >
              <h2 className="text-2xl font-bold">
                {netSaving >= 0 ? "Ja, es lohnt sich." : "Nein, es lohnt sich nicht."}
              </h2>
              <p className="mt-2 text-base">
                {netSaving >= 0
                    ? `Du sparst bei einem vollen Tank ungefähr ${formatCurrency(
                        netSaving
                    )} nach Abzug der Fahrtkosten.`
                    : `Du verlierst ungefähr ${formatCurrency(
                        Math.abs(netSaving)
                    )} durch die Fahrt.`}
              </p>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">Bedienung</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
                <li>Adressen eingeben und auf „Suchen“ klicken.</li>
                <li>Oder auf der Karte klicken: zuerst Start, dann Ziel.</li>
                <li>Regler anpassen und sofort Ergebnis sehen.</li>
                <li>
                  Distanz ist Luftlinie. Für exakte Straßenroute könntest du später
                  OSRM oder GraphHopper ergänzen.
                </li>
              </ul>
            </div>
          </section>
        </div>
      </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-sm text-gray-500">{title}</div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
      </div>
  );
}

function SliderField({
                       label,
                       min,
                       max,
                       step,
                       value,
                       onChange,
                     }: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
      <div>
        <label className="mb-2 block text-sm font-medium">{label}</label>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full"
        />
      </div>
  );
}