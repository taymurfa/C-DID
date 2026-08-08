import { describe, expect, it } from "vitest";
import { dedupeSpeakers } from "@/lib/pipeline/dedupe";
import { demoIngestion } from "@/lib/pipeline/demo-ingestion";

describe("dedupeSpeakers", () => {
  const result = dedupeSpeakers(demoIngestion);

  it("merges the duplicate Maya Chen records into one candidate", () => {
    expect(result.speakersIngested).toBe(5);
    expect(result.candidates).toHaveLength(4);
    const mayas = result.candidates.filter((c) => c.name === "Maya Chen");
    expect(mayas).toHaveLength(1);
  });

  it("fills missing fields from the richer duplicate and normalizes company", () => {
    const maya = result.candidates.find((c) => c.name === "Maya Chen")!;
    expect(maya.title).toBe("VP, Infrastructure Development");
    expect(maya.company).toBe("HelioCore Energy");
    expect(maya.bio).toContain("AI campus");
    expect(maya.sourceIds).toEqual(
      expect.arrayContaining(["sp-maya", "sp-maya-dup"]),
    );
  });

  it("unions topics across duplicates and attaches linked sessions", () => {
    const maya = result.candidates.find((c) => c.name === "Maya Chen")!;
    expect(maya.topics).toEqual(
      expect.arrayContaining(["power", "data centers", "generation"]),
    );
    expect(maya.sessions.map((s) => s.title)).toContain(
      "Behind-the-meter power for AI data center campuses",
    );
  });

  it("rolls up unique companies", () => {
    expect(result.companies.length).toBe(4);
  });
});
