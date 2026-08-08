import { describe, expect, it } from "vitest";
import {
  harvestLinkedInProfiles,
  isLinkedInProfileUrl,
  matchLinkedInForName,
  normalizeLinkedInUrl,
} from "../src/extract/linkedin.js";

describe("normalizeLinkedInUrl", () => {
  it("canonicalizes /in/ profiles and strips tracking + trailing slash", () => {
    expect(
      normalizeLinkedInUrl("https://www.linkedin.com/in/jane-doe/?trk=abc"),
    ).toBe("https://www.linkedin.com/in/jane-doe");
    expect(normalizeLinkedInUrl("https://linkedin.com/in/johnsmith")).toBe(
      "https://www.linkedin.com/in/johnsmith",
    );
  });

  it("handles protocol-relative and bare-domain hrefs", () => {
    expect(normalizeLinkedInUrl("//www.linkedin.com/in/amara-okafor")).toBe(
      "https://www.linkedin.com/in/amara-okafor",
    );
    expect(normalizeLinkedInUrl("www.linkedin.com/in/foo")).toBe(
      "https://www.linkedin.com/in/foo",
    );
  });

  it("accepts locale subdomains and legacy /pub/ profiles", () => {
    expect(normalizeLinkedInUrl("https://uk.linkedin.com/in/someone")).toBe(
      "https://www.linkedin.com/in/someone",
    );
    expect(
      normalizeLinkedInUrl("https://www.linkedin.com/pub/legacy/1/2/3"),
    ).toBe("https://www.linkedin.com/pub/legacy");
  });

  it("rejects company pages and non-LinkedIn URLs", () => {
    expect(
      normalizeLinkedInUrl("https://www.linkedin.com/company/streamworks"),
    ).toBeNull();
    expect(normalizeLinkedInUrl("https://twitter.com/in/jane")).toBeNull();
    expect(normalizeLinkedInUrl("not a url")).toBeNull();
    expect(isLinkedInProfileUrl("https://example.com")).toBe(false);
  });
});

describe("harvest + match", () => {
  const html = `
    <ul>
      <li><a href="https://www.linkedin.com/in/jane-doe/">Jane Doe</a></li>
      <li><a href="https://www.linkedin.com/company/acme">Acme</a></li>
      <li><a href="//linkedin.com/in/amara-okafor">Amara Okafor on LinkedIn</a></li>
    </ul>`;

  it("harvests only personal profiles", () => {
    const profiles = harvestLinkedInProfiles(html);
    const urls = profiles.map((p) => p.url).sort();
    expect(urls).toEqual([
      "https://www.linkedin.com/in/amara-okafor",
      "https://www.linkedin.com/in/jane-doe",
    ]);
  });

  it("matches a speaker name to the right profile", () => {
    const profiles = harvestLinkedInProfiles(html);
    expect(matchLinkedInForName("Jane Doe", profiles)).toBe(
      "https://www.linkedin.com/in/jane-doe",
    );
    expect(matchLinkedInForName("Amara Okafor", profiles)).toBe(
      "https://www.linkedin.com/in/amara-okafor",
    );
    expect(matchLinkedInForName("Someone Else", profiles)).toBeNull();
  });
});
