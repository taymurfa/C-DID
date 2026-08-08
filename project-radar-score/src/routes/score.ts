import type { FastifyInstance } from "fastify";
import { getLatestScoreResult, saveScoreResult } from "../db/mongo.js";
import { runJoin } from "../join/runJoin.js";
import { runScore } from "../score/runScore.js";
import { ScoreRequestSchema } from "../schemas/score.js";

export async function scoreRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/score",
    {
      schema: {
        summary: "Stage inference + rank projects",
        tags: ["radar"],
      },
    },
    async (req, reply) => {
      const parsed = ScoreRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const result = runScore(parsed.data);
      await saveScoreResult(result);
      return result;
    },
  );

  app.get(
    "/projects",
    {
      schema: {
        summary: "Latest scored projects",
        tags: ["radar"],
      },
    },
    async (_req, reply) => {
      const latest = getLatestScoreResult();
      if (!latest) return reply.code(404).send({ error: "no score run yet" });
      return latest;
    },
  );

  app.post(
    "/join",
    {
      schema: {
        summary: "Light people↔project join (Track 2 fixture links)",
        tags: ["radar"],
      },
    },
    async (req, reply) => {
      const body = (req.body ?? {}) as {
        projects?: unknown;
        useLatest?: boolean;
      };
      let projects = getLatestScoreResult()?.projects ?? [];
      if (Array.isArray(body.projects) && body.projects.length) {
        const scored = ScoreRequestSchema.safeParse({ projects: body.projects });
        if (!scored.success) {
          return reply.code(400).send({ error: scored.error.flatten() });
        }
        projects = runScore(scored.data).projects;
      }
      if (!projects.length) {
        return reply.code(404).send({ error: "no projects to join — run /score first" });
      }
      const joins = runJoin(projects);
      return { joins, count: joins.length };
    },
  );
}
