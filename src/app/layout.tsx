import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Tankify",
    description: "Berechnet, ob sich Tanken am Ziel lohnt.",
    icons: {
        icon: "/favicon.ico",
    },
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="de">
        <head>
            <link rel="icon" href="/favicon.ico" sizes="any" />
            <link
                rel="stylesheet"
                href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css"
            />
            <title>Tankify</title>
        </head>
        {/* Browser extensions sometimes inject attributes into <body>, which can trigger hydration mismatch warnings. */}
        <body suppressHydrationWarning>{children}</body>
        </html>
    );
}
