import type { FastifyInstance } from "fastify";
import { isMongoConfigured, isMongoConnected } from "../db/mongo.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        summary: "Liveness check",
        tags: ["system"],
        response: {
          200: {
            type: "object",
            required: ["service", "status"],
            properties: {
              service: { type: "string" },
              status: { type: "string" },
              mongo: { type: "string" },
            },
          },
        },
      },
    },
    async () => ({
      service: "project-radar-ingest",
      status: "ok",
      mongo: !isMongoConfigured()
        ? "skipped"
        : isMongoConnected()
          ? "ok"
          : "down",
    }),
  );
}
