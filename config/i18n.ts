import { Language } from "@/types/tankify";

export type TranslationSchema = {
    settings: {
        title: string;
        language: string;
        german: string;
        english: string;
        currency: string;
        currencyEuro: string;
        currencyDollar: string;
        measurement: string;
        metric: string;
        imperial: string;
    };
    app: {
        title: string;
        subtitle: string;
        mobilePullUp: string;
        mobileTitle: string;
        mobileSubtitle: string;
        adjustCalculator: string;
    };
    route: {
        title: string;
        description: string;
        start: string;
        destination: string;
        pickStart: string;
        pickDestination: string;
        pickHintStart: string;
        pickHintDestination: string;
        setAsStart: string,
        setAsDestination: string;
        startPopup: string;
        destinationPopup: string;
        center: string;
        searchHere: string;
        loading: string;
        tapSearchHere: string;
        areaChanged: string;
        zoomInMore: string;
        stationsLoading: string;
        stationsLoaded: string;
        noStationsFound: string;
        stationsLoadFailed: string;
    };
    pricing: {
        title: string;
        description: string;
        fuelType: string;
        localPrice: string;
        destinationPrice: string;
        priceDifference: string;
        breakEvenDiff: string;
        sourcePrice: string;
        sourceEcontrol: string;
        sourceUnknown: string;
        selectedFuel: string;
        diesel: string;
        super95: string;
    };
    vehicle: {
        title: string;
        description: string;
        consumption: string;
        tankSize: string;
        avgSpeed: string;
        maxConsumption: string;
    };
    result: {
        worthTrip: string;
        estimate: string;
        netSavingAfterTrip: string;
        estimateHint: string;
        importantMetrics: string;
        details: string;
        oneWayDistance: string;
        roundTripDistance: string;
        tripCost: string;
        oneWayDuration: string;
        totalDuration: string;
        fullTankSaving: string;
        netSaving: string;
    };
    profit: {
        notWorthIt: string;
        barelyWorthIt: string;
        worthIt: string;
        veryWorthIt: string;
    };
    station: {
        open: string;
        closed: string;
        unknown: string;
        addressMissing: string;
        cityMissing: string;
        postalCode: string;
        distance: string;
        contact: string;
        phone: string;
        fax: string;
        mail: string;
        website: string;
        services: string;
        payment: string;
        otherOffers: string;
        openingHours: string;
        rawData: string;
    };
    actions: {
        search: string;
        map: string;
        cancel: string;
    };
    status: {
        loading: string;
    };
    units: {
        litersPer100Km: string;
        mpg: string;
        liters: string;
        gallons: string;
        km: string;
        miles: string;
        kmh: string;
        mph: string;
        centPerLiter: string;
        centPerGallon: string;
    };
    errors: {
        searchFailed: string;
        noStartFound: string;
        noDestinationFound: string;
        routeNotCalculated: string;
        routeLoadFailed: string;
        geocodeFailed: string;
    };
};

export const translations: Record<Language, TranslationSchema> = {
    de: {
        settings: {
            title: "Einstellungen",
            language: "Sprache",
            german: "Deutsch",
            english: "Englisch",
            currency: "Währung",
            currencyEuro: "Euro",
            currencyDollar: "US-Dollar",
            measurement: "Einheitensystem",
            metric: "Metrisch",
            imperial: "Imperial",
        },
        app: {
            title: "Tankify",
            subtitle:
                "Berechne, ob sich die Fahrt zu einer günstigeren Tankstelle wirklich auszahlt.",
            mobilePullUp: "Nach oben ziehen für Details",
            mobileTitle: "Tanken am Ziel vergleichen",
            mobileSubtitle:
                "Prüfe, ob sich die Fahrt zum günstigeren Tanken wirklich auszahlt.",
            adjustCalculator: "Rechner anpassen",
        },
        route: {
            title: "Route",
            description:
                "Wähle Start und Ziel, um die Strecke und das Sparpotenzial zu berechnen.",
            start: "Startort",
            destination: "Zielort",
            pickStart: "den Startort",
            pickDestination: "den Zielort",
            pickHintStart: "Klicke jetzt auf die Karte, um den Startort auszuwählen",
            pickHintDestination: "Klicke jetzt auf die Karte, um den Zielort auszuwählen",
            setAsStart: "Als Start wählen",
            setAsDestination: "Als Ziel wählen",
            startPopup: "Start",
            destinationPopup: "Ziel",
            center: "Zentrieren",
            searchHere: "Hier suchen",
            loading: "Lädt ...",
            tapSearchHere: "Tippe auf „Hier suchen“ für Tankstellen.",
            areaChanged: "Kartenausschnitt geändert – „Hier suchen“ drücken.",
            zoomInMore: "Bitte näher hineinzoomen.",
            stationsLoading: "Tankstellen werden geladen ...",
            stationsLoaded: "Tankstellen geladen.",
            noStationsFound: "Keine Tankstellen gefunden.",
            stationsLoadFailed: "Tankstellen konnten nicht geladen werden.",
        },
        pricing: {
            title: "Preise",
            description: "Vergleiche den Preis zuhause mit dem Preis am Ziel.",
            fuelType: "Kraftstoff",
            localPrice: "Preis Vorort",
            destinationPrice: "Preis am Ziel",
            priceDifference: "Preisunterschied",
            breakEvenDiff: "Break-even Preisunterschied",
            sourcePrice: "Preis",
            sourceEcontrol: "Preis: E-Control",
            sourceUnknown: "Preis: —",
            selectedFuel: "Ausgewählter Kraftstoff",
            diesel: "Diesel",
            super95: "Benzin",
        },
        vehicle: {
            title: "Fahrzeug",
            description:
                "Diese Werte beeinflussen die Fahrtkosten und die Ersparnis.",
            consumption: "Verbrauch",
            tankSize: "Tankgröße",
            avgSpeed: "Ø Geschwindigkeit",
            maxConsumption: "Max. Verbrauch",
        },
        result: {
            worthTrip: "Lohnt sich die Fahrt?",
            estimate: "Einschätzung",
            netSavingAfterTrip: "Netto-Ersparnis nach Hin- und Rückfahrt",
            estimateHint:
                "Je weiter rechts, desto mehr lohnt sich das Tanken am Ziel.",
            importantMetrics: "Wichtige Kennzahlen",
            details: "Details",
            oneWayDistance: "Einfache Strecke",
            roundTripDistance: "Hin- und Rückfahrt",
            tripCost: "Fahrtkosten",
            oneWayDuration: "Fahrzeit einfach",
            totalDuration: "Fahrzeit gesamt",
            fullTankSaving: "Ersparnis bei vollem Tank",
            netSaving: "Netto-Ersparnis",
        },
        profit: {
            notWorthIt: "Lohnt sich nicht",
            barelyWorthIt: "Knapp lohnend",
            worthIt: "Lohnend",
            veryWorthIt: "Sehr lohnend",
        },
        station: {
            open: "Geöffnet",
            closed: "Geschlossen",
            unknown: "Öffnungsstatus unbekannt",
            addressMissing: "Keine Adresse verfügbar",
            cityMissing: "Kein Ort verfügbar",
            postalCode: "PLZ",
            distance: "Distanz",
            contact: "Kontakt",
            phone: "Telefon",
            fax: "Fax",
            mail: "E-Mail",
            website: "Website",
            services: "Services",
            payment: "Zahlung",
            otherOffers: "Sonstiges",
            openingHours: "Öffnungszeiten",
            rawData: "Rohdaten (E-Control)",
        },
        actions: {
            search: "Suchen",
            map: "Karte",
            cancel: "Abbrechen",
        },
        status: {
            loading: "Lade...",
        },
        units: {
            litersPer100Km: "L / 100 km",
            mpg: "mpg",
            liters: "L",
            gallons: "gal",
            km: "km",
            miles: "mi",
            kmh: "km/h",
            mph: "mph",
            centPerLiter: "Cent/L",
            centPerGallon: "Cent/gal",
        },
        errors: {
            searchFailed: "Suche fehlgeschlagen. Bitte später erneut probieren.",
            noStartFound: "Kein Ergebnis für Start gefunden.",
            noDestinationFound: "Kein Ergebnis für Ziel gefunden.",
            routeNotCalculated: "Route konnte nicht berechnet werden.",
            routeLoadFailed: "Route konnte nicht geladen werden.",
            geocodeFailed: "Adresssuche fehlgeschlagen.",
        },
    },
    en: {
        settings: {
            title: "Settings",
            language: "Language",
            german: "German",
            english: "English",
            currency: "Currency",
            currencyEuro: "Euro",
            currencyDollar: "US Dollar",
            measurement: "Measurement system",
            metric: "Metric",
            imperial: "Imperial",
        },
        app: {
            title: "Tankify",
            subtitle:
                "Calculate whether the trip to a cheaper gas station is really worth it.",
            mobilePullUp: "Pull up for details",
            mobileTitle: "Compare refueling at destination",
            mobileSubtitle:
                "Check whether the trip for cheaper refueling is actually worth it.",
            adjustCalculator: "Adjust calculator",
        },
        route: {
            title: "Route",
            description:
                "Choose start and destination to calculate the route and savings potential.",
            start: "Start location",
            destination: "Destination",
            pickStart: "the start location",
            pickDestination: "the destination",
            pickHintStart: "Click on the map to set the start location",
            pickHintDestination: "Click on the map to set the destination",
            setAsStart: "Use as start",
            setAsDestination: "Use as destination",
            startPopup: "Start",
            destinationPopup: "Destination",
            center: "Center",
            searchHere: "Search here",
            loading: "Loading ...",
            tapSearchHere: 'Tap "Search here" for gas stations.',
            areaChanged: 'Map area changed – press "Search here".',
            zoomInMore: "Please zoom in more.",
            stationsLoading: "Loading gas stations ...",
            stationsLoaded: "gas stations loaded.",
            noStationsFound: "No gas stations found.",
            stationsLoadFailed: "Could not load gas stations.",
        },
        pricing: {
            title: "Prices",
            description: "Compare the local price with the price at destination.",
            fuelType: "Fuel type",
            localPrice: "Local price",
            destinationPrice: "Destination price",
            priceDifference: "Price difference",
            breakEvenDiff: "Break-even price difference",
            sourcePrice: "Price",
            sourceEcontrol: "Price: E-Control",
            sourceUnknown: "Price: —",
            selectedFuel: "Selected fuel",
            diesel: "Diesel",
            super95: "Gasoline",
        },
        vehicle: {
            title: "Vehicle",
            description:
                "These values affect the trip cost and the total savings.",
            consumption: "Consumption",
            tankSize: "Tank size",
            avgSpeed: "Average speed",
            maxConsumption: "Max consumption",
        },
        result: {
            worthTrip: "Is the trip worth it?",
            estimate: "Assessment",
            netSavingAfterTrip: "Net savings after round trip",
            estimateHint: "The further right, the more worthwhile refueling becomes.",
            importantMetrics: "Key metrics",
            details: "Details",
            oneWayDistance: "One-way distance",
            roundTripDistance: "Round trip",
            tripCost: "Trip cost",
            oneWayDuration: "One-way travel time",
            totalDuration: "Total travel time",
            fullTankSaving: "Savings on full tank",
            netSaving: "Net savings",
        },
        profit: {
            notWorthIt: "Not worth it",
            barelyWorthIt: "Barely worth it",
            worthIt: "Worth it",
            veryWorthIt: "Very worth it",
        },
        station: {
            open: "Open",
            closed: "Closed",
            unknown: "Opening status unknown",
            addressMissing: "No address available",
            cityMissing: "No city available",
            postalCode: "Postal code",
            distance: "Distance",
            contact: "Contact",
            phone: "Phone",
            fax: "Fax",
            mail: "E-mail",
            website: "Website",
            services: "Services",
            payment: "Payment",
            otherOffers: "Other offers",
            openingHours: "Opening hours",
            rawData: "Raw data (E-Control)",
        },
        actions: {
            search: "Search",
            map: "Map",
            cancel: "Cancel",
        },
        status: {
            loading: "Loading...",
        },
        units: {
            litersPer100Km: "L / 100 km",
            mpg: "mpg",
            liters: "L",
            gallons: "gal",
            km: "km",
            miles: "mi",
            kmh: "km/h",
            mph: "mph",
            centPerLiter: "Cent/L",
            centPerGallon: "Cent/gal",
        },
        errors: {
            searchFailed: "Search failed. Please try again later.",
            noStartFound: "No result found for start.",
            noDestinationFound: "No result found for destination.",
            routeNotCalculated: "Route could not be calculated.",
            routeLoadFailed: "Route could not be loaded.",
            geocodeFailed: "Address search failed.",
        },
    },
};

export function getTranslations(language: Language): TranslationSchema {
    return translations[language];
}
