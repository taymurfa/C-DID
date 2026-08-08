import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { getLatestNormalizeResult, saveNormalizeResult } from "../db/mongo.js";
import { runNormalize } from "../normalize/runNormalize.js";
import { NormalizeRequestSchema } from "../schemas/project.js";

export async function normalizeRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/normalize",
    {
      schema: {
        summary: "Normalize + entity-resolve raw records",
        tags: ["radar"],
      },
    },
    async (req, reply) => {
      const parsed = NormalizeRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const result = runNormalize(parsed.data);
      await saveNormalizeResult(result);

      let handoff: { ok: boolean; status?: number; detail?: string } | undefined;
      if (env.handoffEnabled && env.scoreUrl) {
        try {
          const res = await fetch(`${env.scoreUrl.replace(/\/$/, "")}/score`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              normalizeId: result.normalizeId,
              projects: result.projects,
            }),
          });
          handoff = {
            ok: res.ok,
            status: res.status,
            detail: res.ok ? "score accepted" : await res.text(),
          };
        } catch (err) {
          handoff = {
            ok: false,
            detail: err instanceof Error ? err.message : "handoff failed",
          };
        }
      }

      return { ...result, handoff };
    },
  );

  app.get(
    "/projects",
    {
      schema: {
        summary: "Latest normalized projects (in-memory)",
        tags: ["radar"],
      },
    },
    async (_req, reply) => {
      const latest = getLatestNormalizeResult();
      if (!latest) return reply.code(404).send({ error: "no normalize run yet" });
      return latest;
    },
  );
}
