import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

/**
 * Prefer ENV_FILE, then walk up for the repo-root `.env`.
 * Missing files are fine — Compose injects real values via the environment.
 */
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

/** Prefer service-specific port, then Render's PORT, then local default. */
function readListenPort(servicePortKey: string, localDefault: number): number {
  const dedicated = process.env[servicePortKey]?.trim();
  if (dedicated) {
    const parsed = Number.parseInt(dedicated, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return readInt("PORT", localDefault);
}

function readList(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return parts.length ? parts : fallback;
}

export const env = {
  // INTELLIGENCE_PORT for Compose; PORT for Render; else 8002.
  port: readListenPort("INTELLIGENCE_PORT", 8002),
  host: process.env.HOST ?? "0.0.0.0",

  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",

  mongoUri: process.env.MONGODB_URI?.trim() || undefined,
  mongoDb: process.env.MONGODB_DB?.trim() || "speaker_signal_intelligence",
  mongoQualificationsCollection:
    process.env.MONGODB_QUALIFICATIONS_COLLECTION?.trim() || "qualifications",

  qualify: {
    minScore: readInt("QUALIFY_MIN_SCORE", 45),
    eligibleRoles: readList("QUALIFY_ELIGIBLE_ROLES", [
      "speaker",
      "moderator",
      "unknown",
    ]),
    openaiMaxLeads: readInt("QUALIFY_OPENAI_MAX_LEADS", 40),
  },
} as const;

export type AppEnv = typeof env;
