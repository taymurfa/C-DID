import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverPages } from "../src/crawler/discoverPages.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
  join(__dirname, "..", "fixtures", "sample-conference.html"),
  "utf-8",
);
const BASE = "https://example-conf.com";

describe("discoverPages", () => {
  const links = discoverPages(fixtureHtml, BASE, 12);
  const urls = links.map((l) => l.url);

  it("prioritizes agenda/speakers/sessions links", () => {
    expect(urls).toContain("https://example-conf.com/agenda");
    expect(urls).toContain("https://example-conf.com/speakers");
    expect(urls).toContain("https://example-conf.com/sessions");
    // Priority links should rank above anything else.
    expect(links[0].score).toBeGreaterThan(0);
  });

  it("excludes low-value pages", () => {
    expect(urls).not.toContain("https://example-conf.com/tickets");
    expect(urls).not.toContain("https://example-conf.com/privacy");
    expect(urls).not.toContain("https://example-conf.com/sponsors");
    expect(urls).not.toContain("https://example-conf.com/terms");
    expect(urls).not.toContain("https://example-conf.com/login");
  });

  it("stays on the same site (no external domains)", () => {
    for (const url of urls) {
      expect(url.startsWith("https://example-conf.com")).toBe(true);
    }
    expect(urls.some((u) => u.includes("twitter.com"))).toBe(false);
  });

  it("respects the bound on number of pages", () => {
    const limited = discoverPages(fixtureHtml, BASE, 2);
    expect(limited.length).toBeLessThanOrEqual(2);
  });

  it("classifies discovered page types", () => {
    const agenda = links.find(
      (l) => l.url === "https://example-conf.com/agenda",
    );
    expect(agenda?.pageType).toBe("agenda");
    const speakers = links.find(
      (l) => l.url === "https://example-conf.com/speakers",
    );
    expect(speakers?.pageType).toBe("speakers");
  });
});
