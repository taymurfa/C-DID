import pLimit from "p-limit";
import { env } from "../config/env.js";
import { normalizeUrl } from "../crawler/normalizeUrl.js";
import { getPreviousRun } from "../db/mongo.js";
import type { DiscoveredEvent } from "../schemas/event.js";
import { runIngestion } from "./runIngestion.js";

/**
 * Event-driven auto-ingestion.
 *
 * The ingestion service is normally driven by explicit HTTP calls to `/ingest`.
 * This module turns discovery into an *automatic* trigger: whenever a new,
 * relevant conference is surfaced (by `/discover`, or as a `discoveredEvent`
 * while ingesting another conference), it is enqueued and ingested in the
 * background - no manual call required.
 *
 * It is deliberately in-process and dependency-light:
 * - dedupes by normalized URL (in-memory) and against previously stored runs,
 * - gates on `isRelevantConference` + a confidence threshold,
 * - bounds concurrency (politeness / resource safety),
 * - bounds chained discovery depth (prevents runaway crawling of the web).
 */

interface QueueItem {
  url: string;
  depth: number;
  reason: string | null;
  confidence: number;
}

export interface AutoIngestStats {
  enabled: boolean;
  /** Distinct conferences accepted into the queue since boot. */
  enqueued: number;
  completed: number;
  failed: number;
  /** Accepted but skipped because they were already ingested. */
  skipped: number;
  /** Currently running. */
  active: number;
  /** Waiting for a concurrency slot. */
  pending: number;
}

interface Logger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

const consoleLogger: Logger = {
  info: (obj, msg) => console.info(msg ?? "", obj),
  warn: (obj, msg) => console.warn(msg ?? "", obj),
  error: (obj, msg) => console.error(msg ?? "", obj),
};

let log: Logger = consoleLogger;
let limit = pLimit(Math.max(1, env.autoIngest.concurrency));

const seen = new Set<string>();
const counters = { enqueued: 0, completed: 0, failed: 0, skipped: 0 };

/** Swap in the app's structured logger (Fastify/pino) once the server boots. */
export function setAutoIngestLogger(logger: Logger): void {
  log = logger;
}

export function isAutoIngestEnabled(): boolean {
  return env.autoIngest.enabled;
}

export function autoIngestStats(): AutoIngestStats {
  return {
    enabled: env.autoIngest.enabled,
    enqueued: counters.enqueued,
    completed: counters.completed,
    failed: counters.failed,
    skipped: counters.skipped,
    active: limit.activeCount,
    pending: limit.pendingCount,
  };
}

/** Test/maintenance helper: forget dedup history and counters. */
export function resetAutoIngestQueue(): void {
  seen.clear();
  counters.enqueued = 0;
  counters.completed = 0;
  counters.failed = 0;
  counters.skipped = 0;
  limit = pLimit(Math.max(1, env.autoIngest.concurrency));
}

async function alreadyIngested(url: string): Promise<boolean> {
  try {
    return Boolean(await getPreviousRun(url));
  } catch {
    return false;
  }
}

async function processItem(item: QueueItem): Promise<void> {
  if (await alreadyIngested(item.url)) {
    counters.skipped += 1;
    log.info({ url: item.url }, "auto-ingest: skipping already-ingested conference");
    return;
  }

  log.info(
    { url: item.url, depth: item.depth, confidence: item.confidence, reason: item.reason },
    "auto-ingest: starting run",
  );

  try {
    const result = await runIngestion(item.url, {
      maxPages: env.autoIngest.maxPages,
    });
    counters.completed += 1;
    log.info(
      {
        url: item.url,
        runId: result.runId,
        sessions: result.sessions.length,
        speakers: result.speakers.length,
      },
      "auto-ingest: run complete",
    );

    // Chain: relevant events discovered by this run become new triggers, until
    // the depth budget is exhausted.
    if (item.depth < env.autoIngest.maxDepth) {
      enqueueDiscovered(result.discoveredEvents, item.depth + 1);
    }
  } catch (err) {
    counters.failed += 1;
    log.error(
      { url: item.url, err: err instanceof Error ? err.message : String(err) },
      "auto-ingest: run failed",
    );
  }
}

/**
 * Enqueue a single conference for background ingestion. Returns true if it was
 * newly accepted (false when auto-ingest is disabled, the URL is unusable, or
 * it was already queued this session).
 */
export function enqueueConference(
  url: string,
  opts: { depth?: number; reason?: string | null; confidence?: number } = {},
): boolean {
  if (!env.autoIngest.enabled) return false;

  const normalized = normalizeUrl(url);
  if (!normalized || seen.has(normalized)) return false;
  seen.add(normalized);
  counters.enqueued += 1;

  void limit(() =>
    processItem({
      url: normalized,
      depth: opts.depth ?? 0,
      reason: opts.reason ?? null,
      confidence: opts.confidence ?? 1,
    }),
  );

  return true;
}

/**
 * Enqueue the relevant subset of discovered events. Non-relevant or
 * low-confidence candidates are ignored. Returns how many were newly accepted.
 */
export function enqueueDiscovered(
  events: DiscoveredEvent[] | undefined,
  depth = 0,
): number {
  if (!env.autoIngest.enabled || !events?.length) return 0;

  let accepted = 0;
  for (const event of events) {
    if (!event.isRelevantConference) continue;
    if (event.confidence < env.autoIngest.minConfidence) continue;
    if (
      enqueueConference(event.eventUrl, {
        depth,
        reason: event.reason,
        confidence: event.confidence,
      })
    ) {
      accepted += 1;
    }
  }
  return accepted;
}
