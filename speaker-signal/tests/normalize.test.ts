import { describe, expect, it } from "vitest";
import {
  companyKey,
  normalizeCompany,
  normalizeName,
  normalizeTitle,
  personKey,
} from "@/lib/pipeline/normalize";

describe("normalizeName", () => {
  it("strips honorifics and credential suffixes", () => {
    expect(normalizeName("Dr. Maya Chen, PhD")).toBe("Maya Chen");
    expect(normalizeName("Mr. John Smith")).toBe("John Smith");
  });

  it("title-cases all-caps or all-lowercase names", () => {
    expect(normalizeName("MAYA CHEN")).toBe("Maya Chen");
    expect(normalizeName("maya chen")).toBe("Maya Chen");
  });

  it("preserves mixed-case names", () => {
    expect(normalizeName("Sofia McDonald")).toBe("Sofia McDonald");
  });

  it("collapses whitespace", () => {
    expect(normalizeName("  Priya   Shah ")).toBe("Priya Shah");
  });
});

describe("normalizeTitle", () => {
  it("normalizes abbreviations and separators", () => {
    expect(normalizeTitle("svp, project delivery")).toBe("SVP, project delivery");
    expect(normalizeTitle("Director / Grid")).toBe("Director · Grid");
  });

  it("returns null for empty input", () => {
    expect(normalizeTitle(null)).toBeNull();
    expect(normalizeTitle("")).toBeNull();
  });
});

describe("normalizeCompany / companyKey", () => {
  it("title-cases and trims display names", () => {
    expect(normalizeCompany("HELIOCORE ENERGY")).toBe("Heliocore Energy");
    expect(normalizeCompany("HelioCore Energy, Inc.")).toBe(
      "HelioCore Energy, Inc",
    );
  });

  it("collapses legal/generic suffixes into one dedupe key", () => {
    expect(companyKey("HelioCore Energy, Inc.")).toBe("heliocore energy");
    expect(companyKey("HelioCore Energy")).toBe("heliocore energy");
    expect(companyKey("VoltaXis Utilities LLC")).toBe("voltaxis utilities");
  });
});

describe("personKey", () => {
  it("keys on normalized name + company so duplicates collide", () => {
    expect(personKey("MAYA CHEN", "HelioCore Energy, Inc.")).toBe(
      personKey("Maya Chen", "HelioCore Energy"),
    );
  });
});
