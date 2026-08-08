import { NextResponse } from "next/server";
import { QualifyRequestSchema, QualifyResponseSchema } from "@/lib/contracts";
import { demoIngestion } from "@/lib/pipeline/demo-ingestion";
import { IngestionResultSchema, type IngestionResult } from "@/lib/pipeline/ingestion";
import { qualify } from "@/lib/pipeline/qualify";

function isBlockedHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
  );
}

/**
 * Fetch a raw ingestion payload from Agent 1 (speaker-signal-ingestion). The
 * conference websiteUrl is injected so the contract holds even if the upstream
 * payload omits it.
 */
async function fetchFromAgent1(
  agentBase: string,
  conferenceUrl: string,
  maxPages: number | undefined,
): Promise<IngestionResult> {
  const response = await fetch(`${agentBase.replace(/\/$/, "")}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: conferenceUrl, maxPages: maxPages ?? 8 }),
    signal: AbortSignal.timeout(120_000),
  });
  const payload = await response.json();
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Agent 1 returned ${response.status}`;
    throw new Error(message);
  }
  const withUrl =
    payload && typeof payload === "object"
      ? {
          ...(payload as Record<string, unknown>),
          conference: {
            websiteUrl: conferenceUrl,
            ...((payload as { conference?: Record<string, unknown> }).conference ??
              {}),
          },
        }
      : payload;
  return IngestionResultSchema.parse(withUrl);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = QualifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  // `demoMode` is intentionally not destructured: when neither `ingestion` nor
  // `conferenceUrl` is provided, the request validator guarantees demoMode, and
  // the final else-branch handles it.
  const { ingestion, conferenceUrl, agentUrl, maxPages, minTier } = parsed.data;

  try {
    let source: IngestionResult;
    let mode: "live" | "demo";

    if (ingestion) {
      source = IngestionResultSchema.parse(ingestion);
      mode = "live";
    } else if (conferenceUrl) {
      const target = new URL(conferenceUrl);
      if (!/^https?:$/.test(target.protocol) || isBlockedHost(target.hostname)) {
        return NextResponse.json(
          { error: "Only public HTTP(S) conference pages are allowed." },
          { status: 400 },
        );
      }
      const agentBase =
        agentUrl || process.env.INGESTION_URL || "http://localhost:8001";
      source = await fetchFromAgent1(agentBase, target.href, maxPages);
      mode = "live";
    } else {
      source = demoIngestion;
      mode = "demo";
    }

    const result = await qualify(source, { minTier });

    const response = QualifyResponseSchema.parse({
      mode,
      conference: result.conference,
      stats: result.stats,
      leads: result.leads,
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Qualification failed." },
      { status: 502 },
    );
  }
}
