import { beforeEach, describe, expect, it, vi } from "vitest";

// Opt this file back into auto-ingestion (setup.ts disables it globally). This
// must run before the queue module (and thus env.ts) is imported below.
process.env.AUTO_INGEST_ENABLED = "true";
process.env.AUTO_INGEST_MIN_CONFIDENCE = "0.6";
process.env.AUTO_INGEST_MAX_DEPTH = "1";

const runIngestion = vi.fn();
const getPreviousRun = vi.fn(async (): Promise<unknown> => null);

vi.mock("../src/ingest/runIngestion.js", () => ({ runIngestion }));
vi.mock("../src/db/mongo.js", () => ({ getPreviousRun }));

const {
  enqueueConference,
  enqueueDiscovered,
  autoIngestStats,
  resetAutoIngestQueue,
} = await import("../src/ingest/autoIngestQueue.js");

function ingestionResult(url: string, discovered: unknown[] = []) {
  return {
    runId: `run-${url}`,
    conference: { name: null, websiteUrl: url, startDate: null, endDate: null, location: null },
    coverage: {},
    pages: [],
    sessions: [],
    speakers: [],
    discoveredEvents: discovered,
    errors: [],
  };
}

const relevant = (url: string, confidence = 0.9) => ({
  eventName: url,
  eventUrl: url,
  isRelevantConference: true,
  confidence,
  reason: "relevant",
  startDate: null,
});

async function settle() {
  await vi.waitFor(() => {
    const s = autoIngestStats();
    expect(s.active + s.pending).toBe(0);
  });
}

describe("auto-ingest queue (event-driven)", () => {
  beforeEach(() => {
    resetAutoIngestQueue();
    runIngestion.mockReset();
    getPreviousRun.mockReset();
    getPreviousRun.mockResolvedValue(null);
    runIngestion.mockImplementation(async (url: string) => ingestionResult(url));
  });

  it("ingests a newly discovered relevant conference automatically", async () => {
    const accepted = enqueueConference("https://conf.example/2027");
    expect(accepted).toBe(true);

    await settle();
    expect(runIngestion).toHaveBeenCalledTimes(1);
    expect(runIngestion).toHaveBeenCalledWith(
      "https://conf.example/2027",
      expect.objectContaining({ maxPages: expect.any(Number) }),
    );
    expect(autoIngestStats().completed).toBe(1);
  });

  it("dedupes the same conference within a session", async () => {
    expect(enqueueConference("https://conf.example/dup")).toBe(true);
    expect(enqueueConference("https://conf.example/dup")).toBe(false);
    await settle();
    expect(runIngestion).toHaveBeenCalledTimes(1);
  });

  it("filters out non-relevant and low-confidence discoveries", async () => {
    const accepted = enqueueDiscovered([
      relevant("https://good.example/a", 0.95),
      { ...relevant("https://bad.example/b"), isRelevantConference: false },
      relevant("https://weak.example/c", 0.2),
    ]);
    expect(accepted).toBe(1);
    await settle();
    expect(runIngestion).toHaveBeenCalledTimes(1);
    expect(runIngestion).toHaveBeenCalledWith(
      "https://good.example/a",
      expect.anything(),
    );
  });

  it("skips conferences that were already ingested", async () => {
    getPreviousRun.mockResolvedValueOnce({ runId: "prior" });
    enqueueConference("https://conf.example/already");
    await settle();
    expect(runIngestion).not.toHaveBeenCalled();
    expect(autoIngestStats().skipped).toBe(1);
  });

  it("chains discovery up to the depth budget then stops", async () => {
    runIngestion.mockImplementation(async (url: string) => {
      if (url === "https://seed.example/2027") {
        return ingestionResult(url, [relevant("https://child.example/2028", 0.9)]);
      }
      // The child must not chase its own discoveries (depth budget = 1).
      return ingestionResult(url, [relevant("https://grandchild.example/2029", 0.9)]);
    });

    enqueueConference("https://seed.example/2027", { depth: 0 });
    await settle();

    const called = runIngestion.mock.calls.map((c) => c[0]);
    expect(called).toContain("https://seed.example/2027");
    expect(called).toContain("https://child.example/2028");
    expect(called).not.toContain("https://grandchild.example/2029");
  });
});
