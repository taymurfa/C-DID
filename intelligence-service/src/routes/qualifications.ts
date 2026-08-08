import type { FastifyInstance } from "fastify";
import { getLatestQualification } from "../db/mongo.js";

export async function qualificationsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    "/qualifications/latest",
    {
      schema: {
        summary: "Return the most recent persisted qualification run",
        description:
          "Used by Signal Desk to hydrate speakers/companies after a refresh. " +
          "Returns 404 when Mongo is empty or not configured.",
        tags: ["intelligence"],
      },
    },
    async (_request, reply) => {
      const latest = await getLatestQualification();
      if (!latest) {
        return reply.status(404).send({
          error: "No qualification runs stored yet.",
        });
      }
      return reply.status(200).send(latest);
    },
  );
}
