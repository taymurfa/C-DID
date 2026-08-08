import { env } from "../config/env.js";
import type { IngestionResult } from "../schemas/ingestion.js";

interface Logger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}

/**
 * Fire-and-forget hand-off to Agent 2. After Agent 1 finishes ingesting a
 * conference, POST the full result to the intelligence service's `/qualify`
 * endpoint so it becomes normalized, deduplicated, ICP-scored, ranked leads.
 *
 * Never throws: a down or slow Agent 2 must not break ingestion. Skips runs
 * with no speakers (nothing to qualify) and is gated by HANDOFF_ENABLED.
 */
export async function handOffToIntelligence(
  result: IngestionResult,
  log: Logger,
): Promise<void> {
  if (!env.handoff.enabled) return;
  if (result.speakers.length === 0) return;

  const url = `${env.handoff.intelligenceUrl.replace(/\/$/, "")}/qualify`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result),
      signal: AbortSignal.timeout(env.handoff.timeoutMs),
    });

    if (!res.ok) {
      log.warn(
        { runId: result.runId, status: res.status, url },
        "handoff: Agent 2 /qualify returned a non-OK status",
      );
      return;
    }

    const data = (await res.json().catch(() => null)) as {
      leads?: unknown[];
      qualifiedCount?: number;
    } | null;
    log.info(
      {
        runId: result.runId,
        speakers: result.speakers.length,
        leads: data?.qualifiedCount ?? data?.leads?.length ?? null,
      },
      "handoff: qualified conference via Agent 2",
    );
  } catch (err) {
    log.warn(
      {
        runId: result.runId,
        url,
        err: err instanceof Error ? err.message : String(err),
      },
      "handoff: failed to reach Agent 2 /qualify",
    );
  }
}

export function isHandoffEnabled(): boolean {
  return env.handoff.enabled;
}
