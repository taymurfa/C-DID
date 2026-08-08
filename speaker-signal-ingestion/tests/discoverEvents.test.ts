import { describe, expect, it } from "vitest";
import { discoverEvents } from "../src/agent/discoverEvents.js";

const html = `
<!doctype html><html><body>
  <a href="/events/2027-nashville/">View 2027 event</a>
  <a href="/events/2026-nashville/">This year's event</a>
  <a href="/events/">All events</a>
  <a href="/events/2026-boston/">DevOpsDays Boston 2026</a>
  <a href="/privacy">Privacy Policy</a>
  <a href="/tickets">Buy tickets</a>
</body></html>`;

const BASE = "https://devopsdays.org/events/2026-nashville/welcome";
const CURRENT = "https://devopsdays.org/events/2026-nashville/welcome";

describe("discoverEvents (deterministic fallback, no OpenAI)", () => {
  it("finds other-edition events and excludes the current year and junk", async () => {
    const events = await discoverEvents(html, BASE, CURRENT);
    const urls = events.map((e) => e.eventUrl);

    expect(urls).toContain("https://devopsdays.org/events/2027-nashville");
    expect(urls).toContain("https://devopsdays.org/events/2026-boston");

    // Current edition (2026-nashville) should be filtered out.
    expect(urls).not.toContain(
      "https://devopsdays.org/events/2026-nashville",
    );
    // Junk should never appear.
    expect(urls.some((u) => u.includes("privacy"))).toBe(false);
    expect(urls.some((u) => u.includes("tickets"))).toBe(false);

    for (const e of events) {
      expect(e.isRelevantConference).toBe(true);
      expect(e.confidence).toBeGreaterThan(0);
    }
  });
});
