import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/projects/route";
import {
  ProjectRefreshResponseSchema,
  inferProjectStage,
  projectFromDocument,
  resolveProjects,
} from "@/lib/project-radar";

function post(body: unknown): Request {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Project Radar", () => {
  it("infers the most advanced evidenced project stage", () => {
    expect(inferProjectStage("FEED is complete and the board approved final investment decision").stage).toBe("FID");
    expect(inferProjectStage("The generator interconnection agreement was executed").stage).toBe("Interconnection");
    expect(inferProjectStage("Early parcel research only").stage).toBe("Concept");
  });

  it("extracts capacity and a grounded signal from a public document", () => {
    const project = projectFromDocument({
      url: "https://ercot.example/queue/123",
      title: "Lone Star Data Center Energy Park | Queue update",
      markdown: "A 1.2 GW data center power project entered front-end engineering design (FEED).",
      observedAt: new Date("2026-08-08T12:00:00.000Z"),
    });
    expect(project.capacityMw).toBe(1200);
    expect(project.stage).toBe("FEED");
    expect(project.evidence[0].sourceUrl).toBe("https://ercot.example/queue/123");
  });

  it("resolves close aliases and preserves every source record", () => {
    const first = projectFromDocument({
      url: "https://ercot.example/queue/123",
      title: "Lone Star Data Center Energy Park",
      markdown: "A 600 MW project is in FEED.",
    });
    const second = projectFromDocument({
      url: "https://puct.example/docket/9",
      title: "Lone Star Data Center Power Project",
      markdown: "Final investment decision is expected after the hearing.",
    });
    const resolved = resolveProjects([first, second]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].aliases).toContain("Lone Star Data Center Power Project");
    expect(resolved[0].evidence).toHaveLength(2);
    expect(resolved[0].stage).toBe("FID");
  });

  it("returns a contract-valid credential-free demo dataset", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = ProjectRefreshResponseSchema.parse(await response.json());
    expect(payload.mode).toBe("demo");
    expect(payload.projects.length).toBeGreaterThanOrEqual(10);
    expect(payload.projects[0].evidence.length).toBeGreaterThan(1);
  });

  it("blocks private-network sources before live retrieval", async () => {
    const response = await POST(post({ demoMode: false, sourceUrls: ["http://127.0.0.1/docket"] }));
    expect(response.status).toBe(400);
  });
});
