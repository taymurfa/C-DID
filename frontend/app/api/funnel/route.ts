import { NextResponse } from "next/server";
import { gtmApiUrl } from "@/lib/agents";
import { FunnelSchema, LeadStatusSchema } from "@/lib/contracts";
import { z } from "zod";

const FunnelEventBodySchema = z.object({
  leadId: z.string().min(1),
  status: LeadStatusSchema,
  at: z.string().optional(),
  conferenceName: z.string().nullable().optional(),
});

/** GET — proxy GTM funnel roll-up. */
export async function GET() {
  try {
    const response = await fetch(`${gtmApiUrl()}/funnel`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error || `GTM returned ${response.status}` },
        { status: 502 },
      );
    }
    const parsed = FunnelSchema.safeParse(payload);
    if (!parsed.success) {
      // Accept extra leadStatuses from GTM even if FunnelSchema omits them.
      return NextResponse.json(payload);
    }
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "GTM funnel unreachable.",
      },
      { status: 502 },
    );
  }
}

/** POST — proxy a funnel stage event to GTM. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = FunnelEventBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${gtmApiUrl()}/funnel/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error || `GTM returned ${response.status}` },
        { status: response.status },
      );
    }
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "GTM funnel unreachable.",
      },
      { status: 502 },
    );
  }
}
