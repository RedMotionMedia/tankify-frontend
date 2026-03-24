export type EControlFuelType = "DIE" | "SUP" | (string & {});

export type EControlPrice = {
    fuelType?: EControlFuelType;
    amount?: number | null;
    [key: string]: unknown;
};

export type EControlLocation = {
    address?: string;
    postalCode?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    [key: string]: unknown;
};

export type EControlContact = {
    telephone?: string;
    fax?: string;
    mail?: string;
    website?: string;
    [key: string]: unknown;
};

export type EControlOfferInformation = {
    service?: boolean;
    selfService?: boolean;
    unattended?: boolean;
    [key: string]: unknown;
};

export type EControlPaymentMethods = {
    cash?: boolean;
    debitCard?: boolean;
    creditCard?: boolean;
    others?: string;
    [key: string]: unknown;
};

export type EControlPaymentArrangements = {
    cooperative?: boolean;
    clubCard?: boolean;
    clubCardText?: string;
    [key: string]: unknown;
};

export type EControlGasStation = {
    id?: number | string;
    name?: string;
    location?: EControlLocation;
    contact?: EControlContact;
    openingHours?: unknown[];
    offerInformation?: EControlOfferInformation;
    paymentMethods?: EControlPaymentMethods;
    paymentArrangements?: EControlPaymentArrangements;
    otherServiceOffers?: string;
    position?: number;
    open?: boolean | null;
    distance?: number;
    prices?: EControlPrice[];
    [key: string]: unknown;
};

