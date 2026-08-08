import { describe, expect, it } from "vitest";
import {
  computeCoverage,
  desiredPageTypes,
  isCoverageComplete,
} from "../src/agent/coverage.js";
import type { Speaker } from "../src/schemas/speaker.js";
import type { Session } from "../src/schemas/session.js";

const speaker = (over: Partial<Speaker>): Speaker => ({
  sourceId: "sp-1",
  name: "Jane Doe",
  title: null,
  company: null,
  bio: null,
  linkedinUrl: null,
  role: "speaker",
  topics: [],
  sourceUrl: "https://x.com/speakers",
  sourceUrls: ["https://x.com/speakers"],
  sessionSourceIds: [],
  extractionConfidence: 0.8,
  ...over,
});

const session = (over: Partial<Session>): Session => ({
  sourceId: "ses-1",
  title: "Keynote",
  description: null,
  startTime: null,
  endTime: null,
  location: null,
  topics: [],
  sourceUrl: "https://x.com/agenda",
  sourceUrls: ["https://x.com/agenda"],
  speakerSourceIds: [],
  extractionConfidence: 0.8,
  ...over,
});

const baseConf = {
  name: "X",
  websiteUrl: "https://x.com",
  startDate: null,
  endDate: null,
  location: null,
};

describe("coverage", () => {
  it("reports gaps when only speaker names are present", () => {
    const coverage = computeCoverage({
      conference: baseConf,
      sessions: [],
      speakers: [speaker({})],
    });
    expect(coverage.hasSpeakerNames).toBe(true);
    expect(coverage.hasSpeakerTitles).toBe(false);
    expect(coverage.hasAgenda).toBe(false);
    expect(isCoverageComplete(coverage)).toBe(false);
  });

  it("suggests agenda pages when sessions are missing", () => {
    const coverage = computeCoverage({
      conference: baseConf,
      sessions: [],
      speakers: [speaker({})],
    });
    expect(desiredPageTypes(coverage)).toContain("agenda");
  });

  it("suggests profile pages when titles/companies are missing", () => {
    const coverage = computeCoverage({
      conference: baseConf,
      sessions: [session({})],
      speakers: [speaker({})],
    });
    expect(desiredPageTypes(coverage)).toContain("profile");
  });

  it("is complete when everything is present", () => {
    const coverage = computeCoverage({
      conference: { ...baseConf, startDate: "2026-09-15", location: "Austin" },
      sessions: [session({ speakerSourceIds: ["sp-1"] })],
      speakers: [
        speaker({
          title: "VP",
          company: "Cloudscale",
          sessionSourceIds: ["ses-1"],
        }),
      ],
    });
    expect(isCoverageComplete(coverage)).toBe(true);
  });
});
