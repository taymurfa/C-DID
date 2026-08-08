import { NextResponse } from "next/server";
import {
  gtmApiUrl,
  ingestionApiUrl,
  intelligenceApiUrl,
} from "@/lib/agents";

type AgentHealth = {
  service: string;
  status: "ok" | "down";
  mongo?: string;
  url: string;
};

async function probe(name: string, base: string): Promise<AgentHealth> {
  const url = `${base}/health`;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(4_000),
      cache: "no-store",
    });
    if (!response.ok) {
      return { service: name, status: "down", url: base };
    }
    const body = (await response.json()) as {
      service?: string;
      status?: string;
      mongo?: string;
    };
    return {
      service: body.service || name,
      status: body.status === "ok" ? "ok" : "down",
      mongo: body.mongo,
      url: base,
    };
  } catch {
    return { service: name, status: "down", url: base };
  }
}

/** Aggregate Agent 1/2/3 health for the Signal Desk System panel. */
export async function GET() {
  const [ingestion, intelligence, gtm] = await Promise.all([
    probe("ingestion", ingestionApiUrl()),
    probe("intelligence", intelligenceApiUrl()),
    probe("gtm", gtmApiUrl()),
  ]);

  const agents = { ingestion, intelligence, gtm };
  const allOk = Object.values(agents).every((a) => a.status === "ok");

  return NextResponse.json({
    status: allOk ? "ok" : "degraded",
    agents,
  });
}
