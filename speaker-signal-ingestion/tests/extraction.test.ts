import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseConferenceHtml } from "../src/parsers/genericConferenceParser.js";
import { SessionSchema } from "../src/schemas/session.js";
import { SpeakerSchema } from "../src/schemas/speaker.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
  join(__dirname, "..", "fixtures", "sample-conference.html"),
  "utf-8",
);
const SOURCE_URL = "https://example-conf.com/agenda";

describe("genericConferenceParser (deterministic fallback)", () => {
  const result = parseConferenceHtml(fixtureHtml, SOURCE_URL);

  it("extracts conference-level fields", () => {
    expect(result.conference.name).toBe("DevReach 2026");
    expect(result.conference.startDate).toBe("2026-09-15");
    expect(result.conference.endDate).toBe("2026-09-16");
    expect(result.conference.location).toBe("Austin, TX, USA");
  });

  it("extracts exactly 3 sessions with valid shapes", () => {
    expect(result.sessions).toHaveLength(3);
    for (const session of result.sessions) {
      expect(() => SessionSchema.parse(session)).not.toThrow();
    }
  });

  it("extracts session titles, times, and locations", () => {
    const keynote = result.sessions.find(
      (s) => s.sourceId === "ses-opening-keynote",
    );
    expect(keynote).toBeDefined();
    expect(keynote?.title).toBe(
      "Opening Keynote: The Future of Developer Platforms",
    );
    expect(keynote?.startTime).toBe("2026-09-15T09:00:00-05:00");
    expect(keynote?.endTime).toBe("2026-09-15T10:00:00-05:00");
    expect(keynote?.location).toBe("Main Hall");
    expect(keynote?.speakerSourceIds).toEqual(
      expect.arrayContaining(["sp-jane-doe", "sp-sofia-rossi"]),
    );
  });

  it("extracts exactly 5 speakers with names, titles, and companies", () => {
    expect(result.speakers).toHaveLength(5);
    for (const speaker of result.speakers) {
      expect(() => SpeakerSchema.parse(speaker)).not.toThrow();
      expect(speaker.name.length).toBeGreaterThan(0);
      expect(speaker.title).toBeTruthy();
      expect(speaker.company).toBeTruthy();
    }

    const names = result.speakers.map((s) => s.name).sort();
    expect(names).toEqual([
      "Amara Okafor",
      "Jane Doe",
      "John Smith",
      "Liam Chen",
      "Sofia Rossi",
    ]);
  });

  it("captures LinkedIn profile URLs published on the page", () => {
    const byId = new Map(result.speakers.map((s) => [s.sourceId, s]));
    // In-card anchors, canonicalized (tracking params + trailing slash dropped).
    expect(byId.get("sp-jane-doe")?.linkedinUrl).toBe(
      "https://www.linkedin.com/in/jane-doe",
    );
    expect(byId.get("sp-john-smith")?.linkedinUrl).toBe(
      "https://www.linkedin.com/in/johnsmith",
    );
    // Protocol-relative link outside the card, matched back by name.
    expect(byId.get("sp-amara-okafor")?.linkedinUrl).toBe(
      "https://www.linkedin.com/in/amara-okafor",
    );
    // No profile published -> null (never fabricated).
    expect(byId.get("sp-liam-chen")?.linkedinUrl).toBeNull();
    expect(byId.get("sp-sofia-rossi")?.linkedinUrl).toBeNull();
  });

  it("maps speaker companies correctly", () => {
    const byId = new Map(result.speakers.map((s) => [s.sourceId, s]));
    expect(byId.get("sp-jane-doe")?.company).toBe("Cloudscale Inc");
    expect(byId.get("sp-john-smith")?.company).toBe("DataForge");
    expect(byId.get("sp-amara-okafor")?.company).toBe("InsightAI");
    expect(byId.get("sp-liam-chen")?.company).toBe("StreamWorks");
    expect(byId.get("sp-sofia-rossi")?.company).toBe("NimbusCloud");
  });

  it("attaches evidence, role, and confidence to each speaker", () => {
    for (const speaker of result.speakers) {
      expect(speaker.role).toBe("speaker");
      expect(speaker.sourceUrls).toContain(SOURCE_URL);
      expect(speaker.extractionConfidence).toBeGreaterThan(0);
      expect(speaker.extractionConfidence).toBeLessThanOrEqual(1);
    }
    for (const session of result.sessions) {
      expect(session.sourceUrls).toContain(SOURCE_URL);
      expect(session.extractionConfidence).toBeGreaterThan(0);
    }
  });

  it("emits a topics array on every session and speaker", () => {
    for (const speaker of result.speakers) {
      expect(Array.isArray(speaker.topics)).toBe(true);
    }
    for (const session of result.sessions) {
      expect(Array.isArray(session.topics)).toBe(true);
    }
  });

  it("links speakers back to their sessions", () => {
    const jane = result.speakers.find((s) => s.sourceId === "sp-jane-doe");
    expect(jane?.sessionSourceIds).toContain("ses-opening-keynote");

    const liam = result.speakers.find((s) => s.sourceId === "sp-liam-chen");
    expect(liam?.sessionSourceIds).toContain("ses-realtime-streaming");
  });
});
