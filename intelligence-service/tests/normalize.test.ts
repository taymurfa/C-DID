import { describe, expect, it } from "vitest";
import {
  companyKey,
  normalizeCompanyDisplay,
  normalizeName,
  normalizeTitle,
  personKey,
} from "../src/normalize/normalize.js";

describe("normalizeName", () => {
  it("collapses whitespace and title-cases", () => {
    expect(normalizeName("  jane   DOE ")).toBe("Jane Doe");
  });

  it("strips honorifics and trailing credentials", () => {
    expect(normalizeName("Dr. Jane Doe, PhD")).toBe("Jane Doe");
    expect(normalizeName("Mr John Smith Jr")).toBe("John Smith");
  });

  it("preserves intentional internal capitals and short acronyms", () => {
    expect(normalizeName("Sofia McKay")).toBe("Sofia McKay");
  });

  it("returns empty string for junk", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName(null)).toBe("");
  });
});

describe("normalizeTitle", () => {
  it("expands common abbreviations", () => {
    expect(normalizeTitle("vp of engineering")).toBe("VP of engineering");
    expect(normalizeTitle("Sr. Director")).toBe("Senior Director");
  });

  it("returns null for empty", () => {
    expect(normalizeTitle(null)).toBeNull();
    expect(normalizeTitle("   ")).toBeNull();
  });
});

describe("company normalization + key", () => {
  it("keeps a readable display name", () => {
    expect(normalizeCompanyDisplay("Cloudscale Inc.")).toBe("Cloudscale Inc");
  });

  it("collapses legal-suffix variants to one key", () => {
    expect(companyKey("Cloudscale, Inc.")).toBe(companyKey("Cloudscale"));
    expect(companyKey("DataForge LLC")).toBe(companyKey("DataForge"));
    expect(companyKey("The Acme Company")).toBe("acme");
  });

  it("returns null for empty companies", () => {
    expect(companyKey(null)).toBeNull();
    expect(companyKey("")).toBeNull();
  });
});

describe("personKey", () => {
  it("keeps different companies distinct for the same name", () => {
    expect(personKey("John Smith", "DataForge")).not.toBe(
      personKey("John Smith", "NimbusCloud"),
    );
  });

  it("matches the same person across suffix variants", () => {
    expect(personKey("Jane Doe", "Cloudscale Inc.")).toBe(
      personKey("jane doe", "Cloudscale"),
    );
  });
});
