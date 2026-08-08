import { discoverConferences } from "../agent/discoverConferences.js";
import { env } from "../config/env.js";
import { enqueueDiscovered, isAutoIngestEnabled } from "./autoIngestQueue.js";

interface Logger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

/**
 * Startup "grab everything" hook. When `BOOTSTRAP_SEEDS` is configured, run
 * cold-start discovery against those seed pages and feed every relevant hit
 * into the auto-ingest queue - so a freshly started container begins crawling
 * on its own, with no manual HTTP call. Fire-and-forget: failures are logged,
 * never fatal to the server.
 */
export async function runBootstrapDiscovery(log: Logger): Promise<void> {
  const seeds = env.bootstrap.seeds;
  if (seeds.length === 0) return;

  if (!isAutoIngestEnabled()) {
    log.warn(
      { seeds: seeds.length },
      "bootstrap: BOOTSTRAP_SEEDS set but AUTO_INGEST_ENABLED=false; discovered conferences will not be ingested",
    );
  }

  log.info({ seeds }, "bootstrap: discovering conferences from seed URLs");
  try {
    const result = await discoverConferences(seeds, {
      maxPerSeed: env.bootstrap.maxPerSeed,
    });
    const queued = enqueueDiscovered(result.discoveredEvents, 0);
    log.info(
      {
        pagesFetched: result.pagesFetched,
        discovered: result.discoveredEvents.length,
        queued,
        errors: result.errors.length,
      },
      "bootstrap: enqueued discovered conferences for ingestion",
    );
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "bootstrap: discovery failed",
    );
  }
}
