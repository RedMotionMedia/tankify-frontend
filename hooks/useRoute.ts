import { useEffect, useState } from "react";
import { Point, RouteData } from "@/types/tankify";
import { fetchRoute } from "@/lib/route";

export function useRoute(startPoint: Point | null, endPoint: Point | null, requestId: number) {
    const [routeData, setRouteData] = useState<RouteData | null>(null);
    const [routeLoading, setRouteLoading] = useState(false);
    const [routeError, setRouteError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function loadRoute() {
            // Don't auto-calculate; only run when the caller increments the requestId.
            if (requestId <= 0) {
                setRouteLoading(false);
                setRouteError("");
                setRouteData(null);
                return;
            }

            if (!startPoint || !endPoint) {
                setRouteLoading(false);
                setRouteError("ROUTE_NOT_CALCULATED");
                setRouteData(null);
                return;
            }

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
    }, [requestId, startPoint, endPoint]);

    return {
        routeData,
        routeLoading,
        routeError,
    };
}
