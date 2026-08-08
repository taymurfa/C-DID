import { NextResponse } from "next/server";
import { gtmApiUrl } from "@/lib/agents";

export const runtime = "nodejs";

/** Proxy GTM mail status so the desk knows draft-only vs demo send. */
export async function GET() {
  try {
    const response = await fetch(`${gtmApiUrl()}/mail/status`, {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: (payload as { error?: string }).error || "Mail status failed." },
        { status: response.status },
      );
    }
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      {
        smtpConfigured: false,
        sendMode: "mock",
        canSendDemo: false,
        draftOnly: true,
        teamInbox: null,
        error: "GTM mail status unreachable.",
      },
      { status: 200 },
    );
  }
}
