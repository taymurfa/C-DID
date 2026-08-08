import { NextResponse } from "next/server";
import { intelligenceApiUrl } from "@/lib/agents";
import { mapStoredQualificationToQualifyResponse } from "@/lib/map-intelligence";

/**
 * Hydrate Signal Desk from the latest Agent 2 qualification stored in Mongo.
 */
export async function GET() {
  try {
    const response = await fetch(
      `${intelligenceApiUrl()}/qualifications/latest`,
      {
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const payload = await response.json().catch(() => null);
    if (response.status === 404) {
      return NextResponse.json(
        { error: "No stored qualifications yet.", leads: [] },
        { status: 404 },
      );
    }
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error: unknown }).error)
              : `Agent 2 returned ${response.status}`,
        },
        { status: 502 },
      );
    }

    const mapped = mapStoredQualificationToQualifyResponse(payload, "live");
    return NextResponse.json({
      ...mapped,
      source: "agent2-stored",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Intelligence service unreachable.",
      },
      { status: 502 },
    );
  }
}
