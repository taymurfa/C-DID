import { radarIngestApiUrl } from "@/lib/radar-agents";

/**
 * Orchestrated demo path: ingest → normalize → score → join.
 * Prefer this from the atlas UI so one click fills the overlay.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    mode?: "demo" | "live";
  };
  const mode = body.mode === "live" ? "live" : "demo";

  try {
    // Disable agent-side handoff so we control the chain and always get bodies.
    const ingestRes = await fetch(`${radarIngestApiUrl()}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
      cache: "no-store",
    });
    const ingest = (await ingestRes.json()) as {
      runId?: string;
      records?: unknown[];
      recordCount?: number;
      sources?: string[];
      error?: unknown;
      handoff?: unknown;
    };
    if (!ingestRes.ok || !Array.isArray(ingest.records)) {
      return Response.json(
        { error: "ingest failed", detail: ingest },
        { status: ingestRes.ok ? 502 : ingestRes.status },
      );
    }

    const normalizeUrl =
      process.env.RADAR_NORMALIZE_API_URL ||
      process.env.RADAR_NORMALIZE_URL ||
      "http://localhost:8012";
    const normalizeRes = await fetch(
      `${normalizeUrl.replace(/\/$/, "")}/normalize`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runId: ingest.runId,
          records: ingest.records,
        }),
        cache: "no-store",
      },
    );
    const normalize = (await normalizeRes.json()) as {
      normalizeId?: string;
      projects?: unknown[];
      projectCount?: number;
      error?: unknown;
      handoff?: unknown;
    };
    if (!normalizeRes.ok || !Array.isArray(normalize.projects)) {
      return Response.json(
        { error: "normalize failed", detail: normalize, ingest },
        { status: normalizeRes.ok ? 502 : normalizeRes.status },
      );
    }

    const scoreUrl =
      process.env.RADAR_SCORE_API_URL ||
      process.env.RADAR_SCORE_URL ||
      "http://localhost:8013";
    const scoreRes = await fetch(`${scoreUrl.replace(/\/$/, "")}/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        normalizeId: normalize.normalizeId,
        projects: normalize.projects,
      }),
      cache: "no-store",
    });
    const score = (await scoreRes.json()) as {
      scoreId?: string;
      projects?: unknown[];
      projectCount?: number;
      error?: unknown;
    };
    if (!scoreRes.ok || !Array.isArray(score.projects)) {
      return Response.json(
        { error: "score failed", detail: score, normalize, ingest },
        { status: scoreRes.ok ? 502 : scoreRes.status },
      );
    }

    const joinRes = await fetch(`${scoreUrl.replace(/\/$/, "")}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projects: score.projects }),
      cache: "no-store",
    });
    const join = (await joinRes.json().catch(() => ({ joins: [] }))) as {
      joins?: unknown[];
      count?: number;
    };

    return Response.json({
      ok: true,
      mode,
      ingest: {
        runId: ingest.runId,
        recordCount: ingest.recordCount,
        sources: ingest.sources,
      },
      normalize: {
        normalizeId: normalize.normalizeId,
        projectCount: normalize.projectCount,
      },
      score: {
        scoreId: score.scoreId,
        projectCount: score.projectCount,
      },
      projects: score.projects,
      joins: join.joins ?? [],
    });
  } catch (err) {
    return Response.json(
      {
        error: "radar pipeline unreachable",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
