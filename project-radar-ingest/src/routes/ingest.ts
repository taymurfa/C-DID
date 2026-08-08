import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { getRun, saveRun } from "../db/mongo.js";
import { runIngest } from "../ingest/runIngest.js";
import { IngestRequestSchema } from "../schemas/raw.js";

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/ingest",
    {
      schema: {
        summary: "Ingest multi-source project records",
        tags: ["radar"],
        body: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["demo", "live"], default: "demo" },
            sourceIds: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    async (req, reply) => {
      const parsed = IngestRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const run = runIngest(parsed.data);
      await saveRun(run);

      let handoff: { ok: boolean; status?: number; detail?: string } | undefined;
      if (env.handoffEnabled && env.normalizeUrl) {
        try {
          const res = await fetch(`${env.normalizeUrl.replace(/\/$/, "")}/normalize`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ runId: run.runId, records: run.records }),
          });
          handoff = {
            ok: res.ok,
            status: res.status,
            detail: res.ok ? "normalize accepted" : await res.text(),
          };
        } catch (err) {
          handoff = {
            ok: false,
            detail: err instanceof Error ? err.message : "handoff failed",
          };
        }
      }

      return { ...run, handoff };
    },
  );

  app.get(
    "/runs/:id",
    {
      schema: {
        summary: "Fetch a prior ingest run",
        tags: ["radar"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const run = await getRun(id);
      if (!run) return reply.code(404).send({ error: "run not found" });
      return run;
    },
  );
}
