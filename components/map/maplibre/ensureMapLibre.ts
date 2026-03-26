"use client";

export type MapLibreLngLat = { lat: number; lng: number };
export type MapLibreBounds = { extend: (lngLat: [number, number]) => void; isEmpty?: () => boolean };
// MapLibre accepts "LngLatBoundsLike" e.g. [[swLng, swLat], [neLng, neLat]] as well as bounds objects.
export type MapLibreBoundsLike = MapLibreBounds | [[number, number], [number, number]];
export type MapLibreSource = { setData?: (data: unknown) => void };

export type MapLibreMap = {
    on: (type: string, listener: (ev: unknown) => void) => void;
    off: (type: string, listener: (ev: unknown) => void) => void;
    remove: () => void;
    resize: () => void;
    addControl?: (control: unknown, position?: string) => void;
    getZoom: () => number;
    getBounds: () => {
        getSouthWest: () => MapLibreLngLat;
        getNorthEast: () => MapLibreLngLat;
    };
    getCenter: () => MapLibreLngLat;
    fitBounds: (bounds: MapLibreBoundsLike, options: { padding: number; duration?: number }) => void;
    easeTo: (options: { center: [number, number]; zoom: number; duration?: number }) => void;
    addSource: (id: string, source: unknown) => void;
    addLayer: (layer: unknown) => void;
    getSource: (id: string) => MapLibreSource | undefined;
    getLayer: (id: string) => unknown;
};

export type MapLibreMarker = {
    remove: () => void;
    setLngLat: (lngLat: [number, number]) => MapLibreMarker;
    addTo: (map: MapLibreMap) => MapLibreMarker;
    // MapLibre GL JS Marker API.
    getElement?: () => HTMLElement;
};

export type MapLibrePopup = {
    remove: () => void;
    on: (type: "close", listener: () => void) => void;
    setLngLat: (lngLat: [number, number]) => MapLibrePopup;
    setDOMContent: (node: HTMLElement) => MapLibrePopup;
    addTo: (map: MapLibreMap) => MapLibrePopup;
};

export type MapLibreGlobal = {
    Map: new (options: unknown) => MapLibreMap;
    Marker: new (options: { element: HTMLElement; anchor: string }) => MapLibreMarker;
    Popup: new (options: {
        closeButton?: boolean;
        closeOnClick?: boolean;
        maxWidth?: string;
        className?: string;
    }) => MapLibrePopup;
    LngLatBounds: new () => MapLibreBounds;
    NavigationControl?: new (options?: unknown) => unknown;
    AttributionControl?: new (options?: unknown) => unknown;
};

let mapLibreDepsPromise: Promise<void> | null = null;

function loadScriptOnce(id: string, src: string): Promise<void> {
    if (typeof document === "undefined") {
        return Promise.reject(new Error("loadScriptOnce called without document"));
    }

    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === "1") return Promise.resolve();

    if (existing) {
        return new Promise<void>((resolve, reject) => {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error(`script failed: ${src}`)), {
                once: true,
            });
        });
    }

    return new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.id = id;
        s.src = src;
        s.async = true;
        s.addEventListener("load", () => {
            s.dataset.loaded = "1";
            resolve();
        });
        s.addEventListener("error", () => reject(new Error(`script failed: ${src}`)));
        document.head.appendChild(s);
    });
}

function ensureCssOnce(id: string, href: string) {
    if (typeof document === "undefined") return;
    const existing = document.getElementById(id) as HTMLLinkElement | null;
    if (existing) return;

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
}

export function ensureMapLibreDeps(): Promise<void> {
    if (mapLibreDepsPromise) return mapLibreDepsPromise;

    mapLibreDepsPromise = (async () => {
        // CSS is usually injected in app/layout.tsx, but keep this as a safety net.
        ensureCssOnce(
            "tankify-maplibre-gl-css",
            "https://unpkg.com/maplibre-gl/dist/maplibre-gl.css"
        );

        // UMD bundle exposes `maplibregl` globally.
        await loadScriptOnce(
            "tankify-maplibre-gl",
            "https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"
        );
    })();

    return mapLibreDepsPromise;
}

export function getMapLibre(): MapLibreGlobal {
    const gl = (globalThis as unknown as { maplibregl?: unknown }).maplibregl;
    if (!gl) {
        throw new Error("MapLibre not loaded (globalThis.maplibregl missing)");
    }
    return gl as MapLibreGlobal;
}
