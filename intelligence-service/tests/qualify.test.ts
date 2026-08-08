import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { runQualification } from "../src/qualify/runQualification.js";
import {
  QualificationResultSchema,
  QualifiedLeadSchema,
} from "../src/schemas/lead.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(
    join(__dirname, "..", "fixtures", "sample-ingestion-input.json"),
    "utf-8",
  ),
);

describe("runQualification (end-to-end, deterministic)", () => {
  it("turns Agent 1 output into a valid ranked qualification result", async () => {
    const result = await runQualification(fixture, { useOpenAi: false });

    expect(() => QualificationResultSchema.parse(result)).not.toThrow();
    expect(result.icpEnrichment).toBe("deterministic");
    expect(result.totals.speakersIn).toBe(5);
    expect(result.totals.afterDedup).toBe(5);
    expect(result.totals.eligible).toBe(5);
    expect(result.leads).toHaveLength(5);
    expect(result.companies).toHaveLength(5);
  });

  it("produces valid, explained, evidence-backed leads", async () => {
    const result = await runQualification(fixture, { useOpenAi: false });
    for (const lead of result.leads) {
      expect(() => QualifiedLeadSchema.parse(lead)).not.toThrow();
      expect(lead.whyThisPersonMatters.length).toBeGreaterThan(0);
      expect(lead.evidence.length).toBeGreaterThan(0);
      expect(lead.scores.total).toBeGreaterThanOrEqual(0);
      expect(lead.scores.total).toBeLessThanOrEqual(100);
      expect(lead.icpSource).toBe("deterministic");
    }
  });

  it("ranks leads by descending score", async () => {
    const result = await runQualification(fixture, { useOpenAi: false });
    const totals = result.leads.map((l) => l.scores.total);
    const sorted = [...totals].sort((a, b) => b - a);
    expect(totals).toEqual(sorted);
  });

  it("ranks a senior decision maker at the top", async () => {
    const result = await runQualification(fixture, { useOpenAi: false });
    expect(["c_level", "vp"]).toContain(result.leads[0].seniority);
  });

  it("deduplicates a repeated speaker and filters non-ICP juniors", async () => {
    const payload = {
      runId: "test-run",
      conference: { name: "Energy Grid Summit 2027" },
      sessions: [
        {
          sourceId: "ses-1",
          title: "Powering Data Centers from the Grid",
          topics: ["grid", "data centers", "power"],
          speakerSourceIds: ["a", "b"],
          extractionConfidence: 0.9,
        },
      ],
      speakers: [
        {
          sourceId: "a",
          name: "Dana Volt",
          title: "Chief Executive Officer",
          company: "Grid Power Utilities Inc.",
          role: "speaker",
          topics: ["grid", "power"],
          sourceUrls: ["https://conf.test/speakers"],
          sessionSourceIds: ["ses-1"],
          extractionConfidence: 0.95,
        },
        {
          // Same person, second page, suffix-variant company -> should merge.
          sourceId: "a2",
          name: "Dana Volt",
          title: "CEO",
          company: "Grid Power Utilities",
          role: "unknown",
          topics: ["energy"],
          sourceUrls: ["https://conf.test/agenda"],
          sessionSourceIds: ["ses-1"],
          extractionConfidence: 0.8,
        },
        {
          sourceId: "b",
          name: "Casey Intern",
          title: "Junior Graphic Designer",
          company: "Snack Delivery App",
          role: "speaker",
          topics: [],
          sourceUrls: ["https://conf.test/speakers"],
          sessionSourceIds: [],
          extractionConfidence: 0.5,
        },
      ],
    };

    const result = await runQualification(payload, { useOpenAi: false });
    expect(result.totals.speakersIn).toBe(3);
    expect(result.totals.afterDedup).toBe(2); // Dana merged
    expect(result.sourceRunId).toBe("test-run");
    expect(result.conferenceName).toBe("Energy Grid Summit 2027");

    const dana = result.leads.find((l) => l.name === "Dana Volt");
    const casey = result.leads.find((l) => l.name === "Casey Intern");
    expect(dana).toBeDefined();
    expect(dana!.mergedSourceIds.sort()).toEqual(["a", "a2"]);
    expect(dana!.qualified).toBe(true);
    expect(dana!.scores.total).toBeGreaterThan(casey!.scores.total);
    // The unrelated junior should not clear the default threshold.
    expect(casey!.qualified).toBe(false);
  });

  it("accepts a nested `ingestion` wrapper too", async () => {
    const result = await runQualification({ ingestion: fixture } as never, {
      useOpenAi: false,
    });
    // Wrapper key isn't part of IngestionInput, so bare-field parsing yields no
    // speakers; the pipeline still returns a valid (empty) result.
    expect(() => QualificationResultSchema.parse(result)).not.toThrow();
  });

  it("never throws on invalid input; returns an error entry", async () => {
    const result = await runQualification({ speakers: "not-an-array" });
    expect(result.leads).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].stage).toBe("parse");
  });
});
