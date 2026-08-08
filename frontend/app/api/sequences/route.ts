import { NextResponse } from "next/server";
import { gtmApiUrl } from "@/lib/agents";

/**
 * List hydrated GTM sequences (Agent 3 import + dashboard shapes).
 * Used to bootstrap Speakers / Sequences without re-running Analyze.
 */
export async function GET() {
  try {
    const response = await fetch(`${gtmApiUrl()}/sequences`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error || "Failed to list sequences.", sequences: [] },
        { status: response.status },
      );
    }
    return NextResponse.json({
      sequences: Array.isArray(payload?.sequences) ? payload.sequences : [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "GTM sequences unreachable.",
        sequences: [],
      },
      { status: 502 },
    );
  }
}
