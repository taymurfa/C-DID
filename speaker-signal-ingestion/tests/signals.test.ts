import { describe, expect, it } from "vitest";
import {
  analyzeContentSignals,
  classifyPageTypeByUrl,
  detectYear,
  looksLikeEventLink,
  scoreLink,
} from "../src/agent/signals.js";

describe("signals.scoreLink", () => {
  it("scores priority links above generic ones", () => {
    const agenda = scoreLink("https://x.com/agenda", "Agenda");
    const generic = scoreLink("https://x.com/about", "About us");
    expect(agenda).toBeGreaterThan(generic);
  });

  it("hard-excludes junk links", () => {
    expect(scoreLink("https://x.com/privacy", "Privacy")).toBe(-1);
    expect(scoreLink("https://x.com/tickets", "Buy tickets")).toBe(-1);
    expect(scoreLink("https://x.com/login", "Login")).toBe(-1);
  });

  it("boosts domain-theme links", () => {
    const themed = scoreLink(
      "https://x.com/data-center-power-summit",
      "Data Center Power Summit",
    );
    expect(themed).toBeGreaterThan(0);
  });
});

describe("signals.classifyPageTypeByUrl", () => {
  it("classifies common page types", () => {
    expect(classifyPageTypeByUrl("https://x.com/agenda")).toBe("agenda");
    expect(classifyPageTypeByUrl("https://x.com/speakers")).toBe("speakers");
    expect(classifyPageTypeByUrl("https://x.com/events/2027-boston")).toBe(
      "series",
    );
  });
});

describe("signals.analyzeContentSignals", () => {
  it("detects people, titles, companies, times and dates", () => {
    const text =
      "September 15, 2026 - 9:00 AM Opening Keynote. " +
      "Jane Doe, VP of Engineering at Cloudscale Inc. " +
      "John Smith, Director at DataForge Systems. Panel discussion.";
    const s = analyzeContentSignals(text);
    expect(s.hasPeopleNames).toBe(true);
    expect(s.hasJobTitles).toBe(true);
    expect(s.hasCompanies).toBe(true);
    expect(s.hasTimes).toBe(true);
    expect(s.hasDates).toBe(true);
    expect(s.score).toBeGreaterThan(0.4);
  });

  it("scores empty/junk text low", () => {
    const s = analyzeContentSignals("Cookie preferences. Accept all.");
    expect(s.score).toBeLessThan(0.3);
  });
});

describe("signals event helpers", () => {
  it("detects a year", () => {
    expect(detectYear("View 2027 event")).toBe(2027);
    expect(detectYear("no year here")).toBeNull();
  });

  it("recognizes event-like links", () => {
    expect(
      looksLikeEventLink("https://x.com/events/2027-boston", "Boston Summit 2027"),
    ).toBe(true);
    expect(looksLikeEventLink("https://x.com/privacy", "Privacy")).toBe(false);
  });
});
