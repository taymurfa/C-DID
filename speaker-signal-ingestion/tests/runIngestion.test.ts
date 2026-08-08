import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { runIngestion } from "../src/ingest/runIngestion.js";
import { IngestionResultSchema } from "../src/schemas/ingestion.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
  join(__dirname, "..", "fixtures", "sample-conference.html"),
  "utf-8",
);

describe("runIngestion (offline seed HTML)", () => {
  it("produces a schema-valid IngestionResult from seed HTML", async () => {
    const result = await runIngestion("https://example-conf.com", {
      seedHtml: fixtureHtml,
      persist: false,
    });

    expect(() => IngestionResultSchema.parse(result)).not.toThrow();
    expect(result.runId).toMatch(/[0-9a-f-]{36}/);
    expect(result.sessions).toHaveLength(3);
    expect(result.speakers).toHaveLength(5);
    expect(result.errors).toHaveLength(0);
    expect(result.pages).toHaveLength(1);
    expect(result.conference.name).toBe("DevReach 2026");
  });
});
