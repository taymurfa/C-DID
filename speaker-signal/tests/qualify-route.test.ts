import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/qualify/route";
import { QualifyResponseSchema } from "@/lib/contracts";

function post(body: unknown): Request {
  return new Request("http://localhost/api/qualify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/qualify", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ranked qualified leads in demo mode", async () => {
    const res = await POST(post({ demoMode: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    const parsed = QualifyResponseSchema.parse(json);
    expect(parsed.mode).toBe("demo");
    expect(parsed.leads.length).toBeGreaterThan(0);
    expect(parsed.stats.speakersIngested).toBe(5);
  });

  it("rejects an empty request (no ingestion/url/demo)", async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
  });

  it("rejects private-network conference URLs", async () => {
    const res = await POST(post({ conferenceUrl: "http://127.0.0.1/agenda" }));
    expect(res.status).toBe(400);
  });

  it("accepts a raw ingestion payload directly", async () => {
    const ingestion = {
      runId: "t",
      conference: {
        name: "Test Power Summit",
        websiteUrl: "https://example.com/tps",
        startDate: null,
        endDate: null,
        location: null,
      },
      sessions: [],
      speakers: [
        {
          sourceId: "s1",
          name: "Dana Fields",
          title: "VP of Procurement",
          company: "Gridworks Power",
          bio: "Owns grid procurement.",
          role: "speaker",
          topics: ["grid", "procurement"],
          sourceUrl: "https://example.com/tps/dana",
          sourceUrls: ["https://example.com/tps/dana"],
          sessionSourceIds: [],
          extractionConfidence: 0.9,
        },
      ],
    };
    const res = await POST(post({ ingestion, minTier: "C" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.leads[0].name).toBe("Dana Fields");
  });

  it("sends Agent 1 the documented ingestion request contract", async () => {
    const ingestion = {
      runId: "agent-1-run",
      conference: {
        name: "Grid Delivery Summit",
        websiteUrl: "https://conference.example/agenda",
        startDate: null,
        endDate: null,
        location: null,
      },
      sessions: [],
      speakers: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(ingestion), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      post({
        conferenceUrl: "https://conference.example/agenda",
        agentUrl: "http://localhost:8001",
        maxPages: 6,
      }),
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8001/ingest");
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      conferenceUrl: "https://conference.example/agenda",
      maxPages: 6,
      discoverEvents: true,
    });
  });
});
