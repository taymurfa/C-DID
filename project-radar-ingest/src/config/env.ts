import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

function resolveEnvFile(): string {
  if (process.env.ENV_FILE) return process.env.ENV_FILE;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), "..", ".env");
}

loadDotenv({ path: resolveEnvFile() });

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readListenPort(servicePortKey: string, localDefault: number): number {
  const dedicated = process.env[servicePortKey]?.trim();
  if (dedicated) {
    const parsed = Number.parseInt(dedicated, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return readInt("PORT", localDefault);
}

export const env = {
  port: readListenPort("RADAR_INGEST_PORT", 8011),
  host: process.env.HOST ?? "0.0.0.0",
  mongoUri: process.env.MONGODB_URI?.trim() || undefined,
  mongoDb: process.env.MONGODB_DB?.trim() || "project_radar_ingest",
  mongoRunsCollection: process.env.MONGODB_RUNS_COLLECTION?.trim() || "runs",
  normalizeUrl:
    process.env.RADAR_NORMALIZE_URL?.trim() ||
    process.env.NORMALIZE_URL?.trim() ||
    undefined,
  handoffEnabled: (process.env.HANDOFF_ENABLED ?? "true").toLowerCase() !== "false",
} as const;
