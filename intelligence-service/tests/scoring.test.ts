import { describe, expect, it } from "vitest";
import type { DedupedSpeaker } from "../src/dedupe/dedupe.js";
import {
  buildScoreContext,
  scoreSpeakerDeterministic,
} from "../src/score/deterministicScore.js";
import { InputSessionSchema } from "../src/schemas/ingestionInput.js";

function speaker(partial: Partial<DedupedSpeaker>): DedupedSpeaker {
  return {
    key: partial.name?.toLowerCase() ?? "x",
    name: partial.name ?? "Test Person",
    originalName: partial.name ?? "Test Person",
    title: partial.title ?? null,
    company: partial.company ?? null,
    companyKey: partial.companyKey ?? null,
    bio: partial.bio ?? null,
    role: partial.role ?? "speaker",
    topics: partial.topics ?? [],
    sessionSourceIds: partial.sessionSourceIds ?? [],
    sourceUrls: partial.sourceUrls ?? [],
    mergedSourceIds: partial.mergedSourceIds ?? ["s1"],
    extractionConfidence: partial.extractionConfidence ?? 0.9,
  };
}

const session = InputSessionSchema.parse({
  sourceId: "ses-grid",
  title: "Scaling Grid Interconnection for Data Centers",
  topics: ["grid", "data centers"],
});
const ctx = buildScoreContext([session]);

describe("scoreSpeakerDeterministic", () => {
  it("scores an energy C-level buyer highly across signals", () => {
    const parts = scoreSpeakerDeterministic(
      speaker({
        name: "Grace Power",
        title: "Chief Technology Officer",
        company: "Grid Energy Systems",
        topics: ["grid", "energy"],
        sessionSourceIds: ["ses-grid"],
      }),
      ctx,
    );
    expect(parts.seniorityLevel).toBe("c_level");
    expect(parts.buyingInfluence).toBe(1);
    expect(parts.companyIcpFit).toBeGreaterThan(0.6);
    expect(parts.topicRelevance).toBeGreaterThan(0.5);
    expect(parts.matchedTopics).toContain("grid");
  });

  it("scores an unrelated junior contributor low on ICP + buying", () => {
    const parts = scoreSpeakerDeterministic(
      speaker({
        name: "Sam Junior",
        title: "Junior Frontend Developer",
        company: "Foodie App",
        topics: [],
      }),
      ctx,
    );
    expect(parts.buyingInfluence).toBeLessThan(0.4);
    expect(parts.companyIcpFit).toBeLessThan(0.5);
    expect(parts.topicRelevance).toBeLessThan(0.3);
  });

  it("pulls session topics into topic relevance even without speaker topics", () => {
    const withSession = scoreSpeakerDeterministic(
      speaker({
        name: "Pat Link",
        title: "Director",
        company: "Acme",
        sessionSourceIds: ["ses-grid"],
      }),
      ctx,
    );
    const withoutSession = scoreSpeakerDeterministic(
      speaker({ name: "Pat Link", title: "Director", company: "Acme" }),
      ctx,
    );
    expect(withSession.topicRelevance).toBeGreaterThan(
      withoutSession.topicRelevance,
    );
  });
});
