import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

/**
 * Resolve the single source of truth for configuration: the shared
 * `backend/.env`. We deliberately never read a service-local `.env` - the
 * backend file is the only one that should provide OPENAI_API_KEY / MONGODB_URI.
 *
 * We walk up from this module's own location (not the current working
 * directory) so the path holds no matter where the process is launched from or
 * whether we're running source (tsx) or built output (dist). `ENV_FILE` still
 * wins if explicitly set.
 */
function resolveBackendEnv(): string {
  if (process.env.ENV_FILE) return process.env.ENV_FILE;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, "backend", ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Last-resort fallback to the original cwd-relative convention.
  return resolve(process.cwd(), "..", "backend", ".env");
}

loadDotenv({ path: resolveBackendEnv() });

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  // Use a dedicated INTELLIGENCE_PORT so we stay on 8002 and never inherit the
  // backend's generic PORT (e.g. 5001) or Agent 1's 8001 from the shared .env.
  port: readInt("INTELLIGENCE_PORT", 8002),
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
