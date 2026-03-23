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
        <body>{children}</body>
        </html>
    );
}