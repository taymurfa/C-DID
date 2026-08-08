import { describe, expect, it, vi } from "vitest";

const indexHtml = `
<!doctype html><html><body>
  <a href="/events/2027-nashville/">DevOpsDays Nashville 2027</a>
  <a href="/events/2026-boston/">DevOpsDays Boston 2026</a>
  <a href="/privacy">Privacy Policy</a>
  <a href="/tickets">Buy tickets</a>
</body></html>`;

vi.mock("../src/crawler/fetchPage.js", () => ({
  fetchPage: vi.fn(async (url: string) => ({
    url,
    finalUrl: url,
    html: indexHtml,
    statusCode: 200,
    fetchedWith: "cheerio" as const,
    contentHash: "hash",
  })),
}));

const { discoverConferences } = await import(
  "../src/agent/discoverConferences.js"
);
const { fetchPage } = await import("../src/crawler/fetchPage.js");

describe("discoverConferences (cold-start)", () => {
  it("aggregates candidate events from seed pages and skips junk", async () => {
    const result = await discoverConferences([
      "https://devopsdays.org/events/",
    ]);

    const urls = result.discoveredEvents.map((e) => e.eventUrl);
    expect(urls).toContain("https://devopsdays.org/events/2027-nashville");
    expect(urls).toContain("https://devopsdays.org/events/2026-boston");
    expect(urls.some((u) => u.includes("privacy"))).toBe(false);
    expect(urls.some((u) => u.includes("tickets"))).toBe(false);

    expect(result.pagesFetched).toBe(1);
    expect(result.errors).toHaveLength(0);
    // Sorted by confidence descending.
    for (let i = 1; i < result.discoveredEvents.length; i++) {
      expect(result.discoveredEvents[i - 1].confidence).toBeGreaterThanOrEqual(
        result.discoveredEvents[i].confidence,
      );
    }
  });

  it("dedupes the same event discovered across multiple seeds", async () => {
    const result = await discoverConferences([
      "https://devopsdays.org/events/",
      "https://devopsdays.org/past/",
    ]);
    const urls = result.discoveredEvents.map((e) => e.eventUrl);
    const unique = new Set(urls);
    expect(urls.length).toBe(unique.size);
    expect(result.pagesFetched).toBe(2);
  });

  it("records an error when a seed fails to fetch but still returns", async () => {
    vi.mocked(fetchPage).mockRejectedValueOnce(new Error("boom"));
    const result = await discoverConferences([
      "https://broken.example/events/",
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].stage).toBe("discover");
    expect(result.discoveredEvents).toHaveLength(0);
  });
});
