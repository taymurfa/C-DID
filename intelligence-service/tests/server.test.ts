import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(
    join(__dirname, "..", "fixtures", "sample-ingestion-input.json"),
    "utf-8",
  ),
);

describe("HTTP server", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ service: "intelligence", status: "ok" });
  });

  it("POST /qualify scores the bare ingestion payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/qualify",
      payload: { ...fixture, useOpenAi: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.leads).toHaveLength(5);
    expect(body.totals.speakersIn).toBe(5);
    expect(body.leads[0].whyThisPersonMatters).toBeTruthy();
  });

  it("POST /qualify accepts a nested `ingestion` wrapper", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/qualify",
      payload: { ingestion: fixture, useOpenAi: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.leads).toHaveLength(5);
  });

  it("POST /qualify honors a minScore override", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/qualify",
      payload: { ...fixture, useOpenAi: false, minScore: 100 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().totals.qualified).toBe(0);
  });
});
