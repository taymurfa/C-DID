import { NextResponse } from "next/server";
import { ingestionApiUrl } from "@/lib/agents";
import { z } from "zod";

const DiscoverBodySchema = z.object({
  seedUrls: z.array(z.string().url()).min(1).max(10),
  maxPerSeed: z.number().int().positive().max(20).optional(),
});

/** Proxy Agent 1 POST /discover for conference calendar expansion. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = DiscoverBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${ingestionApiUrl()}/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(120_000),
    });
    const payload = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error: unknown }).error)
              : `Agent 1 returned ${response.status}`,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Agent 1 discover unreachable.",
      },
      { status: 502 },
    );
  }
}
