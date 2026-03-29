import TankifyCalculator from "@/features/tankify/shared/components/calculator/TankifyCalculator";

// Do not prerender/cache the HTML for the homepage.
// This avoids stale UI after deploys behind proxies/CDNs.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
    return <TankifyCalculator />;
}
