import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("gtm-service HTTP", () => {
  it("GET /health", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.service).toBe("gtm");
    expect(body.status).toBe("ok");
  });

  it("POST /sequences then GET /sequences/:id", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/sequences",
      payload: {
        lead: {
          id: "lead-1",
          name: "Dana Fields",
          title: "VP Procurement",
          company: "Gridworks",
          session: "Buying power",
          topics: ["procurement"],
          evidence: [],
        },
        conference: {
          name: "Test Summit",
          startDate: "2026-10-01T00:00:00.000Z",
          location: "Denver",
        },
        now: "2026-09-01T00:00:00.000Z",
      },
    });
    expect(create.statusCode).toBe(200);
    const created = create.json();
    expect(created.id).toBeTruthy();
    expect(created.steps).toHaveLength(5);
    expect(created.drafts).toHaveLength(5);

    const get = await app.inject({
      method: "GET",
      url: `/sequences/${created.id}`,
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().id).toBe(created.id);

    const patch = await app.inject({
      method: "PATCH",
      url: `/sequences/${created.id}/steps/${created.steps[0].id}`,
      payload: { status: "Sent" },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().steps[0].status).toBe("Sent");
  });

  it("POST /funnel/events then GET /funnel", async () => {
    const event = await app.inject({
      method: "POST",
      url: "/funnel/events",
      payload: { leadId: "lead-funnel", status: "contacted" },
    });
    expect(event.statusCode).toBe(201);

    const funnel = await app.inject({ method: "GET", url: "/funnel" });
    expect(funnel.statusCode).toBe(200);
    const body = funnel.json();
    expect(body.stages).toHaveLength(7);
    expect(body.leadStatuses["lead-funnel"]).toBe("contacted");
  });

  it("GET /mail/status", async () => {
    const res = await app.inject({ method: "GET", url: "/mail/status" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.smtpConfigured).toBe("boolean");
    expect(body.sendMode).toBeTruthy();
    expect(body.draftOnly).toBe(true);
    expect(body.canSendDemo).toBe(false);
    expect(body.teamInbox).toBeTruthy();
  });

  it("POST /mail/test in mock mode", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mail/test",
      payload: { to: "faruquitaymur@gmail.com" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.to).toBe("faruquitaymur@gmail.com");
    expect(body.mode).toBe("mock");
  });

  it("POST /mail/send-demo routes to team inbox in mock mode", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mail/send-demo",
      payload: {
        subject: "Quick note ahead of GridForward",
        body: "Hi Maya,\n\nYour session caught my eye.\n\nBest,\nAlex\n\nReply STOP to opt out.",
        leadName: "Maya Chen",
        company: "HelioCare Energy",
        conference: "GridForward Summit",
        anchor: "T-14",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("mock");
    expect(body.draftOnly).toBe(true);
    expect(body.to).toBe("faruquitaymur@gmail.com");
  });
});
