import { NextResponse } from "next/server";
import { ingestionApiUrl, intelligenceApiUrl } from "@/lib/agents";
import { QualifyRequestSchema, QualifyResponseSchema } from "@/lib/contracts";
import { mapIntelligenceToQualifyResponse } from "@/lib/map-intelligence";
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
 * Fetch a raw ingestion payload from Agent 1 (speaker-signal-ingestion).
 */
async function fetchFromAgent1(
  agentBase: string,
  conferenceUrl: string,
  maxPages: number | undefined,
): Promise<IngestionResult> {
  const response = await fetch(`${agentBase.replace(/\/$/, "")}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conferenceUrl,
      maxPages: maxPages ?? 8,
      discoverEvents: true,
    }),
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

/**
 * Live scoring brain: Agent 2 POST /qualify. Falls back to embedded Person 2
 * when intelligence is unreachable so demo judging still works offline.
 */
async function qualifyViaIntelligence(
  source: IngestionResult,
  minTier: "A" | "B" | "C" | "D" | undefined,
): Promise<ReturnType<typeof mapIntelligenceToQualifyResponse> | null> {
  const base = intelligenceApiUrl();
  try {
    const response = await fetch(`${base}/qualify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingestion: source }),
      signal: AbortSignal.timeout(120_000),
    });
    const payload = await response.json();
    if (!response.ok) {
      return null;
    }
    const mapped = mapIntelligenceToQualifyResponse(payload, source, "live");
    if (minTier) {
      const rank: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
      const min = rank[minTier] ?? 2;
      mapped.leads = mapped.leads
        .filter((l) => (rank[l.tier] ?? 0) >= min)
        .map((l, i) => ({ ...l, rank: i + 1 }));
      mapped.stats.qualified = mapped.leads.length;
    }
    return mapped;
  } catch {
    return null;
  }
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

  const {
    ingestion,
    conferenceUrl,
    agentUrl,
    maxPages,
    minTier,
    demoMode,
  } = parsed.data;

  try {
    let source: IngestionResult;
    let mode: "live" | "demo";

    // Explicit demo wins when no raw ingestion was provided.
    if (demoMode && !ingestion) {
      source = demoIngestion;
      mode = "demo";
    } else if (ingestion) {
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
      const agentBase = agentUrl || ingestionApiUrl();
      source = await fetchFromAgent1(agentBase, target.href, maxPages);
      mode = "live";
    } else {
      source = demoIngestion;
      mode = "demo";
    }

    // Demo mode keeps the embedded Person 2 pipeline (offline / no Atlas).
    // Live mode prefers Agent 2, with embedded fallback if Agent 2 is down.
    if (mode === "live") {
      const fromAgent2 = await qualifyViaIntelligence(source, minTier);
      if (fromAgent2) {
        const response = QualifyResponseSchema.parse({
          ...fromAgent2,
          source: "agent2",
          degraded: false,
        });
        return NextResponse.json(response);
      }

      const result = await qualify(source, { minTier });
      const response = QualifyResponseSchema.parse({
        mode: "live",
        source: "embedded",
        degraded: true,
        conference: result.conference,
        stats: result.stats,
        leads: result.leads,
      });
      return NextResponse.json(response);
    }

    const result = await qualify(source, { minTier });
    const response = QualifyResponseSchema.parse({
      mode: "demo",
      source: "embedded",
      degraded: false,
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
