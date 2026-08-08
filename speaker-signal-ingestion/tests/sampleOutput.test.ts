import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { IngestionResultSchema } from "../src/schemas/ingestion.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("fixtures/sample-ingestion-output.json", () => {
  it("matches the IngestionResult contract (what Agent 2 builds against)", () => {
    const raw = readFileSync(
      join(__dirname, "..", "fixtures", "sample-ingestion-output.json"),
      "utf-8",
    );
    const parsed = IngestionResultSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(parsed.error.flatten());
    }
    expect(parsed.success).toBe(true);
  });
});
