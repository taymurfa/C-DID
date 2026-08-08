/**
 * Resolve backend base URLs for Compose / local runs.
 * Prefer *_API_URL (Compose), fall back to legacy names and localhost.
 */
export function ingestionApiUrl(): string {
  return (
    process.env.INGESTION_API_URL ||
    process.env.INGESTION_URL ||
    "http://localhost:8001"
  ).replace(/\/$/, "");
}

export function intelligenceApiUrl(): string {
  return (
    process.env.INTELLIGENCE_API_URL ||
    process.env.INTELLIGENCE_URL ||
    "http://localhost:8002"
  ).replace(/\/$/, "");
}

export function gtmApiUrl(): string {
  return (
    process.env.GTM_API_URL ||
    process.env.GTM_URL ||
    "http://localhost:8003"
  ).replace(/\/$/, "");
}

export function defaultDemoMode(): boolean {
  const raw = process.env.NEXT_PUBLIC_DEMO_MODE;
  if (raw === undefined || raw === "") return true;
  return raw === "true" || raw === "1";
}
