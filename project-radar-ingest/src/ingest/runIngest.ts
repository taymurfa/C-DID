import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuid } from "uuid";
import type { IngestRequest, IngestRun, RawRecord } from "../schemas/raw.js";
import { RawRecordSchema } from "../schemas/raw.js";

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/demo-sources.json",
);

function loadFixtureRecords(): RawRecord[] {
  const raw = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as {
    records: unknown[];
  };
  return raw.records.map((r) => RawRecordSchema.parse(r));
}

/**
 * Demo ingest always returns the multi-source fixture set.
 * Live mode is a POC stub that returns the same fixtures with a note —
 * real PUCT/TCEQ scrapers are out of scope for the weekend POC.
 */
export function runIngest(req: IngestRequest): IngestRun {
  let records = loadFixtureRecords();
  if (req.sourceIds?.length) {
    const wanted = new Set(req.sourceIds);
    records = records.filter(
      (r) => wanted.has(r.id) || wanted.has(r.sourceId) || wanted.has(r.source),
    );
  }

  const sources = [...new Set(records.map((r) => r.source))];
  return {
    runId: uuid(),
    mode: req.mode,
    createdAt: new Date().toISOString(),
    recordCount: records.length,
    sources,
    records,
    note:
      req.mode === "live"
        ? "POC live mode: returning fixture multi-source set (bounded public scrapers not wired)."
        : "Demo multi-source ingest: ERCOT GIS + PUCT + TCEQ fixtures.",
  };
}
