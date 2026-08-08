import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";

describe("GET /health", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the ingestion status payload", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ service: "ingestion", status: "ok" });
  });

  it("rejects an invalid /ingest body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/ingest",
      payload: { conferenceUrl: "not-a-url" },
    });
    expect(res.statusCode).toBe(400);
  });
});
