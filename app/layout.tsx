import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Tankify",
    description: "Berechnet, ob sich Tanken am Ziel lohnt.",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="de">
        <head>
            <link
                rel="stylesheet"
                href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css"
            />
        </head>
        {/* Browser extensions sometimes inject attributes into <body>, which can trigger hydration mismatch warnings. */}
        <body suppressHydrationWarning>{children}</body>
        </html>
    );
}
