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
