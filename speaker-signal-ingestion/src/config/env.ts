import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

// Load the shared backend/.env so this service reuses the system's
// OPENAI_API_KEY / MONGODB_URI. npm scripts run from the service directory, so
// the backend folder is at ../backend. Override with ENV_FILE if needed.
const sharedEnvPath =
  process.env.ENV_FILE ?? resolve(process.cwd(), "..", "backend", ".env");
loadDotenv({ path: sharedEnvPath });

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return !["false", "0", "no", "off"].includes(raw.trim().toLowerCase());
}

function readFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  // Use a dedicated INGESTION_PORT so we stay on 8001 and never inherit the
  // backend's generic PORT (e.g. 5001) from the shared .env.
  port: readInt("INGESTION_PORT", 8001),
  host: process.env.HOST ?? "0.0.0.0",

  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",

  mongoUri: process.env.MONGODB_URI?.trim() || undefined,
  mongoDb: process.env.MONGODB_DB?.trim() || "speaker_signal_ingestion",
  mongoRunsCollection: process.env.MONGODB_RUNS_COLLECTION?.trim() || "runs",

  crawl: {
    maxPages: readInt("CRAWL_MAX_PAGES", 12),
    maxDepth: readInt("CRAWL_MAX_DEPTH", 2),
    concurrency: readInt("CRAWL_CONCURRENCY", 2),
    requestDelayMs: readInt("CRAWL_REQUEST_DELAY_MS", 750),
    requestTimeoutMs: readInt("CRAWL_REQUEST_TIMEOUT_MS", 20000),
    maxRetries: readInt("CRAWL_MAX_RETRIES", 2),
    retryBaseMs: readInt("CRAWL_RETRY_BASE_MS", 500),
    userAgent:
      process.env.CRAWL_USER_AGENT?.trim() ||
      "SpeakerSignalIngestionBot/0.1 (+https://example.com/bot)",
  },

  respectRobots: readBool("RESPECT_ROBOTS", true),

  // Event-driven automation: when a new relevant conference is discovered (via
  // /discover, or as a `discoveredEvent` during an /ingest run), automatically
  // enqueue it for ingestion instead of waiting for a manual HTTP call.
  autoIngest: {
    enabled: readBool("AUTO_INGEST_ENABLED", true),
    // Only auto-ingest events at/above this confidence and flagged relevant.
    minConfidence: readFloat("AUTO_INGEST_MIN_CONFIDENCE", 0.6),
    // How many auto-ingest runs may execute at once.
    concurrency: readInt("AUTO_INGEST_CONCURRENCY", 1),
    // How far to chase chained discoveries (0 = only the seed's direct hits).
    maxDepth: readInt("AUTO_INGEST_MAX_DEPTH", 1),
    // Page budget for an auto-triggered run (defaults to the crawl budget).
    maxPages: readInt("AUTO_INGEST_MAX_PAGES", readInt("CRAWL_MAX_PAGES", 12)),
  },
} as const;

export type AppEnv = typeof env;
