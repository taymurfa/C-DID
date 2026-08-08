import { describe, expect, it } from "vitest";
import { QualifyResponseSchema } from "@/lib/contracts";
import { demoIngestion } from "@/lib/pipeline/demo-ingestion";
import { qualify } from "@/lib/pipeline/qualify";

const NOW = new Date("2026-08-25T00:00:00.000Z");

describe("qualify (end-to-end, deterministic)", () => {
  it("turns raw ingestion into ranked, filtered, explainable leads", async () => {
    const result = await qualify(demoIngestion, { now: NOW, minTier: "C" });

    expect(result.stats.speakersIngested).toBe(5);
    expect(result.stats.afterDedupe).toBe(4);
    expect(result.stats.scoredWithOpenAI).toBe(false);

    // The journalist (tier D) is filtered out; 3 ICP leads remain.
    expect(result.leads).toHaveLength(3);
    expect(result.leads.some((l) => l.name === "Jordan Blake")).toBe(false);
  });

  it("ranks by score descending with sequential ranks", async () => {
    const { leads } = await qualify(demoIngestion, { now: NOW });
    for (let i = 1; i < leads.length; i++) {
      expect(leads[i - 1].score).toBeGreaterThanOrEqual(leads[i].score);
    }
    expect(leads.map((l) => l.rank)).toEqual([1, 2, 3]);
  });

  it("attaches a reason, evidence, and a valid confidence to every lead", async () => {
    const { leads } = await qualify(demoIngestion, { now: NOW });
    for (const lead of leads) {
      expect(lead.scoreReason.length).toBeGreaterThan(0);
      expect(lead.evidence.length).toBeGreaterThan(0);
      expect(lead.confidence).toBeGreaterThan(0);
      expect(lead.confidence).toBeLessThanOrEqual(1);
      expect(lead.isICP).toBe(true);
    }
  });

  it("dedupes Maya to a single normalized lead", async () => {
    const { leads } = await qualify(demoIngestion, { now: NOW });
    const mayas = leads.filter((l) => l.name === "Maya Chen");
    expect(mayas).toHaveLength(1);
    expect(mayas[0].company).toBe("HelioCore Energy");
  });

  it("produces output that satisfies the QualifyResponse contract", async () => {
    const result = await qualify(demoIngestion, { now: NOW });
    const payload = { mode: "demo" as const, ...result };
    expect(() => QualifyResponseSchema.parse(payload)).not.toThrow();
  });
});
