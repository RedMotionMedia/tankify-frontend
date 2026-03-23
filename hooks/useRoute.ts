import { useEffect, useState } from "react";
import { Point, RouteData } from "@/types/tankify";
import { fetchRoute } from "@/lib/route";

export function useRoute(startPoint: Point, endPoint: Point) {
    const [routeData, setRouteData] = useState<RouteData | null>(null);
    const [routeLoading, setRouteLoading] = useState(false);
    const [routeError, setRouteError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function loadRoute() {
            setRouteLoading(true);
            setRouteError("");

            try {
                const route = await fetchRoute(startPoint, endPoint);

                if (cancelled) return;

                if (route) {
                    setRouteData(route);
                } else {
                    setRouteError("ROUTE_NOT_CALCULATED");
                    setRouteData(null);
                }
            } catch {
                if (!cancelled) {
                    setRouteError("ROUTE_LOAD_FAILED");
                    setRouteData(null);
                }
            } finally {
                if (!cancelled) setRouteLoading(false);
            }
        }

        loadRoute();

        return () => {
            cancelled = true;
        };
    }, [startPoint, endPoint]);

    return {
        routeData,
        routeLoading,
        routeError,
    };
}