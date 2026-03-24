const KM_PER_MILE = 1.609344;
const LITERS_PER_GALLON = 3.785411784;

export function kmToMiles(km: number) {
    return km / KM_PER_MILE;
}

export function milesToKm(miles: number) {
    return miles * KM_PER_MILE;
}

export function litersToGallons(liters: number) {
    return liters / LITERS_PER_GALLON;
}

export function gallonsToLiters(gallons: number) {
    return gallons * LITERS_PER_GALLON;
}

export function lPer100KmToMpg(lPer100Km: number) {
    if (lPer100Km <= 0) return 0;
    return 235.214583 / lPer100Km;
}

export function mpgToLPer100Km(mpg: number) {
    if (mpg <= 0) return 0;
    return 235.214583 / mpg;
}

export function kmhToMph(kmh: number) {
    return kmToMiles(kmh);
}

export function mphToKmh(mph: number) {
    return milesToKm(mph);
}

export function pricePerLiterToPerGallon(pricePerLiter: number) {
    return pricePerLiter * LITERS_PER_GALLON;
}

export function pricePerGallonToPerLiter(pricePerGallon: number) {
    return pricePerGallon / LITERS_PER_GALLON;
}