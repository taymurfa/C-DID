import { describe, expect, it } from "vitest";
import { dedupeSpeakers } from "@/lib/pipeline/dedupe";
import { demoIngestion } from "@/lib/pipeline/demo-ingestion";
import {
  buyingInfluenceScore,
  eventProximity,
  scoreCandidate,
  seniorityScore,
} from "@/lib/pipeline/score";

const NOW = new Date("2026-08-25T00:00:00.000Z");

describe("seniorityScore", () => {
  it("ranks C-suite above VP above director above IC", () => {
    expect(seniorityScore("Chief Development Officer")).toBe(15);
    expect(seniorityScore("VP, Infrastructure")).toBe(12);
    expect(seniorityScore("Director, Grid")).toBe(11);
    expect(seniorityScore("Software Engineer")).toBe(4);
    expect(seniorityScore(null)).toBe(3);
  });
});

describe("buyingInfluenceScore", () => {
  it("rewards procurement/development functions", () => {
    expect(buyingInfluenceScore("Head of Procurement")).toBe(10);
    expect(buyingInfluenceScore("Chief Development Officer")).toBe(9);
    expect(buyingInfluenceScore("Marketing Coordinator")).toBe(4);
  });
});

describe("eventProximity", () => {
  it("peaks for imminent events and decays with distance", () => {
    expect(
      eventProximity({ ...demoIngestion.conference }, NOW),
    ).toBe(10); // ~9 days out
    expect(
      eventProximity({ ...demoIngestion.conference, startDate: "2027-06-01" }, NOW),
    ).toBe(1);
    expect(
      eventProximity({ ...demoIngestion.conference, startDate: "2026-01-01" }, NOW),
    ).toBe(1); // already happened
    expect(
      eventProximity({ ...demoIngestion.conference, startDate: null }, NOW),
    ).toBe(3);
  });
});

describe("scoreCandidate", () => {
  const candidates = dedupeSpeakers(demoIngestion).candidates;
  const byName = new Map(candidates.map((c) => [c.name, c]));

  it("scores an ICP energy executive into tier A", () => {
    const maya = scoreCandidate(byName.get("Maya Chen")!, demoIngestion.conference, NOW);
    expect(maya.tier).toBe("A");
    expect(maya.breakdown.roleFit).toBe(20);
    expect(maya.breakdown.topicRelevance).toBe(25);
    const sum =
      maya.breakdown.roleFit +
      maya.breakdown.companyFit +
      maya.breakdown.topicRelevance +
      maya.breakdown.seniority +
      maya.breakdown.buyingInfluence +
      maya.breakdown.eventProximity;
    expect(sum).toBe(maya.total);
  });

  it("pushes a journalist at a media company into tier D", () => {
    const jordan = scoreCandidate(byName.get("Jordan Blake")!, demoIngestion.conference, NOW);
    expect(jordan.tier).toBe("D");
    expect(jordan.breakdown.companyFit).toBe(3);
  });

  it("always produces at least one piece of evidence with a source url", () => {
    for (const c of candidates) {
      const scored = scoreCandidate(c, demoIngestion.conference, NOW);
      expect(scored.evidence.length).toBeGreaterThan(0);
      for (const e of scored.evidence) {
        expect(e.sourceUrl).toMatch(/^https?:\/\//);
      }
    }
  });
});
