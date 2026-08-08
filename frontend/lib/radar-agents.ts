/**
 * Resolve Project Radar agent base URLs for Compose / local runs.
 */
export function radarIngestApiUrl(): string {
  return (
    process.env.RADAR_INGEST_API_URL ||
    process.env.RADAR_INGEST_URL ||
    "http://localhost:8011"
  ).replace(/\/$/, "");
}

export function radarNormalizeApiUrl(): string {
  return (
    process.env.RADAR_NORMALIZE_API_URL ||
    process.env.RADAR_NORMALIZE_URL ||
    "http://localhost:8012"
  ).replace(/\/$/, "");
}

export function radarScoreApiUrl(): string {
  return (
    process.env.RADAR_SCORE_API_URL ||
    process.env.RADAR_SCORE_URL ||
    "http://localhost:8013"
  ).replace(/\/$/, "");
}
