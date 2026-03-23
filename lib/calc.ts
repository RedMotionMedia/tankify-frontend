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

export function calculateTankify(params: {
    oneWayKm: number;
    durationHours: number;
    localPrice: number;
    destinationPrice: number;
    consumption: number;
    tankSize: number;
    avgSpeed: number;
}) {
    const {
        oneWayKm,
        durationHours,
        localPrice,
        destinationPrice,
        consumption,
        tankSize,
        avgSpeed,
    } = params;

    const roundTripKm = oneWayKm * 2;
    const estimatedHoursOneWay =
        durationHours > 0 ? durationHours : avgSpeed > 0 ? oneWayKm / avgSpeed : 0;
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

    return {
        roundTripKm,
        estimatedHoursOneWay,
        estimatedHoursRoundTrip,
        tripLiters,
        tripCost,
        priceDifference,
        grossSavingFullTank,
        netSaving,
        breakEvenDiff,
        maxConsumption,
    };
}