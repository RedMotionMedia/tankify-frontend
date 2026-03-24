import {
    kmToMiles,
    litersToGallons,
    lPer100KmToMpg,
    pricePerLiterToPerGallon,
} from "@/lib/units";

export type TankifyCalculation = {
    oneWayDistanceKm: number;
    oneWayDistanceMiles: number;
    roundTripDistanceKm: number;
    roundTripDistanceMiles: number;

    estimatedHoursOneWay: number;
    estimatedHoursRoundTrip: number;

    tripLiters: number;
    tripGallons: number;
    tripCost: number;

    priceDifferencePerLiter: number;
    priceDifferencePerGallon: number;

    grossSavingFullTank: number;
    netSaving: number;

    breakEvenDiffPerLiter: number;
    breakEvenDiffPerGallon: number;

    maxConsumptionLPer100Km: number;
    maxConsumptionMpg: number;
};

export function getProfitLevel(netSaving: number) {
    if (netSaving < 0) {
        return {
            labelKey: "notWorthIt" as const,
            colorClass: "text-red-600",
            bgClass: "bg-red-50",
            percent: 10,
        };
    }

    if (netSaving < 5) {
        return {
            labelKey: "barelyWorthIt" as const,
            colorClass: "text-yellow-600",
            bgClass: "bg-yellow-50",
            percent: 40,
        };
    }

    if (netSaving < 15) {
        return {
            labelKey: "worthIt" as const,
            colorClass: "text-lime-600",
            bgClass: "bg-lime-50",
            percent: 70,
        };
    }

    return {
        labelKey: "veryWorthIt" as const,
        colorClass: "text-green-600",
        bgClass: "bg-green-50",
        percent: 100,
    };
}

type CalculateTankifyParams = {
    oneWayKm: number;
    durationHours: number;
    localPricePerLiter: number;
    destinationPricePerLiter: number;
    consumptionLPer100Km: number;
    tankSizeLiters: number;
    avgSpeedKmh: number;
};

export function calculateTankify({
                                     oneWayKm,
                                     durationHours,
                                     localPricePerLiter,
                                     destinationPricePerLiter,
                                     consumptionLPer100Km,
                                     tankSizeLiters,
                                     avgSpeedKmh,
                                 }: CalculateTankifyParams): TankifyCalculation {
    const roundTripKm = oneWayKm * 2;

    const estimatedHoursOneWay =
        durationHours > 0
            ? durationHours
            : avgSpeedKmh > 0
                ? oneWayKm / avgSpeedKmh
                : 0;

    const estimatedHoursRoundTrip = estimatedHoursOneWay * 2;

    const tripLiters = (roundTripKm / 100) * consumptionLPer100Km;
    const tripGallons = litersToGallons(tripLiters);

    const tripCost = tripLiters * destinationPricePerLiter;

    const priceDifferencePerLiter = localPricePerLiter - destinationPricePerLiter;
    const priceDifferencePerGallon =
        pricePerLiterToPerGallon(priceDifferencePerLiter);

    const grossSavingFullTank = tankSizeLiters * priceDifferencePerLiter;
    const netSaving = grossSavingFullTank - tripCost;

    const breakEvenDiffPerLiter =
        tankSizeLiters > 0 ? tripCost / tankSizeLiters : 0;

    const breakEvenDiffPerGallon =
        pricePerLiterToPerGallon(breakEvenDiffPerLiter);

    const maxConsumptionLPer100Km =
        roundTripKm > 0 && destinationPricePerLiter > 0
            ? (tankSizeLiters * priceDifferencePerLiter) /
            ((roundTripKm / 100) * destinationPricePerLiter)
            : 0;

    const maxConsumptionMpg = lPer100KmToMpg(maxConsumptionLPer100Km);

    return {
        oneWayDistanceKm: oneWayKm,
        oneWayDistanceMiles: kmToMiles(oneWayKm),
        roundTripDistanceKm: roundTripKm,
        roundTripDistanceMiles: kmToMiles(roundTripKm),

        estimatedHoursOneWay,
        estimatedHoursRoundTrip,

        tripLiters,
        tripGallons,
        tripCost,

        priceDifferencePerLiter,
        priceDifferencePerGallon,

        grossSavingFullTank,
        netSaving,

        breakEvenDiffPerLiter,
        breakEvenDiffPerGallon,

        maxConsumptionLPer100Km,
        maxConsumptionMpg,
    };
}