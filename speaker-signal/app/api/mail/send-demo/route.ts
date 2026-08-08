import { NextResponse } from "next/server";
import { z } from "zod";
import { gtmApiUrl } from "@/lib/agents";

export const runtime = "nodejs";

const BodySchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  leadName: z.string().optional(),
  company: z.string().optional(),
  conference: z.string().optional(),
  anchor: z.string().optional(),
});

/** Demo send — always to team inbox via GTM. Never emails the lead. */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${gtmApiUrl()}/mail/send-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: (payload as { error?: string }).error || "Demo send failed." },
        { status: response.status },
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "GTM unreachable for demo send.",
      },
      { status: 502 },
    );
  }
}
