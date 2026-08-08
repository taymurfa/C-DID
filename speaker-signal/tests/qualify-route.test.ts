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
    // Agent 2 unreachable → embedded Person 2 fallback still qualifies.
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

  it("live path calls Agent 1 then Agent 2 /qualify", async () => {
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
      speakers: [
        {
          sourceId: "s1",
          name: "Dana Fields",
          title: "VP of Procurement",
          company: "Gridworks Power",
          bio: "Owns grid procurement.",
          role: "speaker",
          topics: ["grid", "procurement"],
          sourceUrl: "https://conference.example/dana",
          sourceUrls: ["https://conference.example/dana"],
          sessionSourceIds: [],
          extractionConfidence: 0.9,
        },
      ],
    };

    const agent2 = {
      qualificationId: "q1",
      conferenceName: "Grid Delivery Summit",
      totals: {
        speakersIn: 1,
        afterDedup: 1,
        eligible: 1,
        qualified: 1,
        companies: 1,
      },
      icpEnrichment: "deterministic",
      leads: [
        {
          leadId: "dana",
          name: "Dana Fields",
          title: "VP of Procurement",
          company: "Gridworks Power",
          role: "speaker",
          topics: ["grid", "procurement"],
          sessionTitles: ["Buying power"],
          sourceUrls: ["https://conference.example/dana"],
          scores: {
            total: 72,
            roleFit: 0.9,
            companyIcpFit: 0.8,
            seniority: 0.85,
            topicRelevance: 0.7,
            buyingInfluence: 0.6,
            confidence: 0.75,
          },
          tier: "B",
          qualified: true,
          whyThisPersonMatters: "Owns procurement at an ICP company.",
          evidence: ["Agenda listing"],
          icpSource: "deterministic",
          mergedSourceIds: ["s1"],
          seniority: "vp",
          companyKey: "gridworks power",
          originalName: "Dana Fields",
        },
      ],
      companies: [],
      errors: [],
    };

    const fetchMock = vi.fn(
      async (...args: [RequestInfo | URL, RequestInit?]) => {
      const url = String(args[0]);
      if (url.endsWith("/ingest")) {
        return new Response(JSON.stringify(ingestion), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/qualify")) {
        return new Response(JSON.stringify(agent2), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    },
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
    const json = await res.json();
    expect(json.mode).toBe("live");
    expect(json.leads[0].name).toBe("Dana Fields");
    expect(json.leads[0].score).toBe(72);

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain("http://localhost:8001/ingest");
    expect(urls.some((u) => u.endsWith("/qualify"))).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      conferenceUrl: "https://conference.example/agenda",
      maxPages: 6,
      discoverEvents: true,
    });
  });
});
