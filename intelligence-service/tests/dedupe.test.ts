import { describe, expect, it } from "vitest";
import { dedupeCompanies, dedupeSpeakers } from "../src/dedupe/dedupe.js";
import { InputSpeakerSchema } from "../src/schemas/ingestionInput.js";

function speaker(partial: Record<string, unknown>) {
  return InputSpeakerSchema.parse(partial);
}

describe("dedupeSpeakers", () => {
  it("merges the same person scraped from two pages", () => {
    const input = [
      speaker({
        sourceId: "a",
        name: "Jane Doe",
        title: "Principal Engineer",
        company: "Cloudscale Inc.",
        role: "unknown",
        topics: ["ai"],
        sourceUrls: ["https://x.com/speakers"],
        sessionSourceIds: ["ses-1"],
        extractionConfidence: 0.6,
      }),
      speaker({
        sourceId: "b",
        name: "  jane   doe ",
        title: null,
        company: "Cloudscale",
        role: "speaker",
        topics: ["grid"],
        sourceUrls: ["https://x.com/agenda"],
        sessionSourceIds: ["ses-2"],
        extractionConfidence: 0.9,
      }),
    ];

    const out = dedupeSpeakers(input);
    expect(out).toHaveLength(1);
    const merged = out[0];
    expect(merged.name).toBe("Jane Doe");
    expect(merged.title).toBe("Principal Engineer");
    expect(merged.role).toBe("speaker"); // most informative role wins
    expect(merged.topics.sort()).toEqual(["ai", "grid"]);
    expect(merged.sessionSourceIds.sort()).toEqual(["ses-1", "ses-2"]);
    expect(merged.sourceUrls).toHaveLength(2);
    expect(merged.mergedSourceIds.sort()).toEqual(["a", "b"]);
    expect(merged.extractionConfidence).toBe(0.9); // strongest observation
  });

  it("keeps two different people who share a name but not a company", () => {
    const input = [
      speaker({ sourceId: "a", name: "John Smith", company: "DataForge" }),
      speaker({ sourceId: "b", name: "John Smith", company: "NimbusCloud" }),
    ];
    expect(dedupeSpeakers(input)).toHaveLength(2);
  });

  it("drops records with an unusable (empty) name", () => {
    const input = [speaker({ sourceId: "a", name: "   " })];
    expect(dedupeSpeakers(input)).toHaveLength(0);
  });
});

describe("dedupeCompanies", () => {
  it("collapses suffix variants into one company", () => {
    const speakers = dedupeSpeakers([
      speaker({ sourceId: "a", name: "Jane Doe", company: "Cloudscale Inc." }),
      speaker({ sourceId: "b", name: "Bob Roe", company: "Cloudscale" }),
      speaker({ sourceId: "c", name: "Amy Lee", company: "DataForge LLC" }),
    ]);
    const companies = dedupeCompanies(speakers);
    expect(companies).toHaveLength(2);
    const cloud = companies.find((c) => c.companyKey === "cloudscale");
    expect(cloud?.speakerKeys).toHaveLength(2);
  });
});
