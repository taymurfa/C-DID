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
    const rootEnv = resolve(dir, ".env");
    if (existsSync(rootEnv)) return rootEnv;
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

export const env = {
  // GTM_PORT for Compose; PORT for Render; else 8003.
  port: readListenPort("GTM_PORT", 8003),
  host: process.env.HOST ?? "0.0.0.0",

  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",

  mongoUri: process.env.MONGODB_URI?.trim() || undefined,
  mongoDb: process.env.MONGODB_DB?.trim() || "speaker_signal_gtm",
  mongoSequencesCollection:
    process.env.MONGODB_SEQUENCES_COLLECTION?.trim() || "sequences",
  mongoFunnelEventsCollection:
    process.env.MONGODB_FUNNEL_EVENTS_COLLECTION?.trim() || "funnel_events",

  // Email delivery. SEND_MODE=mock logs only; real needs SMTP_USER + SMTP_PASSWORD.
  sendMode: (process.env.SEND_MODE?.trim().toLowerCase() || "mock") as
    | "mock"
    | "real"
    | string,
  senderName: process.env.SENDER_NAME?.trim() || "Speaker Signal",
  senderEmail:
    process.env.SMTP_FROM?.trim() ||
    process.env.SENDER_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    undefined,
  testToEmail:
    process.env.TEST_TO_EMAIL?.trim() ||
    "kirill.cheldishkin2105@gmail.com",
  smtpHost: process.env.SMTP_HOST?.trim() || "smtp.zoho.com",
  smtpPort: readInt("SMTP_PORT", 587),
  smtpUser: process.env.SMTP_USER?.trim() || undefined,
  smtpPassword: process.env.SMTP_PASSWORD?.trim().replace(/^["']|["']$/g, "") || undefined,
} as const;

export type AppEnv = typeof env;
