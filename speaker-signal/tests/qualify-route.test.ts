import { describe, expect, it } from "vitest";
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
});
