import { NextResponse } from "next/server";

export const runtime = "nodejs";

function allowDebugUi(): boolean {
    const raw = (process.env.NEXT_PUBLIC_ENABLE_DEBUG_MODE ?? "").trim();
    if (raw === "1") return true;
    // In non-production dev builds we always allow it.
    return process.env.NODE_ENV !== "production";
}

export async function GET() {
    return NextResponse.json(
        { debugUiAllowed: allowDebugUi() },
        {
            headers: {
                // This must reflect runtime env changes (no caching).
                "Cache-Control": "no-store, max-age=0",
            },
        }
    );
}

