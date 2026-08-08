import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Opt in before the client (and env.ts) load; setup.ts disables it globally.
process.env.HANDOFF_ENABLED = "true";
process.env.INTELLIGENCE_URL = "http://agent2.local:8002";

const { handOffToIntelligence } = await import(
  "../src/handoff/qualifyClient.js"
);

function result(overrides: Record<string, unknown> = {}) {
  return {
    runId: "run-1",
    conference: {
      name: "C",
      websiteUrl: "https://c.example",
      startDate: null,
      endDate: null,
      location: null,
    },
    coverage: {},
    pages: [],
    sessions: [],
    speakers: [
      {
        sourceId: "s1",
        name: "Ada",
        role: "speaker",
        sourceUrl: "https://c.example",
        sourceUrls: [],
        sessionSourceIds: [],
        topics: [],
        extractionConfidence: 0.9,
      },
    ],
    discoveredEvents: [],
    errors: [],
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const log = { info: vi.fn(), warn: vi.fn() };

describe("handOffToIntelligence", () => {
  beforeEach(() => {
    log.info.mockReset();
    log.warn.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the full result to Agent 2 /qualify when there are speakers", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ qualifiedCount: 2 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await handOffToIntelligence(result(), log);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://agent2.local:8002/qualify");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).runId).toBe("run-1");
    expect(log.info).toHaveBeenCalled();
  });

  it("skips the call when there are no speakers", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await handOffToIntelligence(result({ speakers: [] }), log);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when Agent 2 is unreachable", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(handOffToIntelligence(result(), log)).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalled();
  });
});
