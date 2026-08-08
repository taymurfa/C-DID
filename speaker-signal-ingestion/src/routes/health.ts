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
              service: { type: "string", example: "ingestion" },
              status: { type: "string", example: "ok" },
              mongo: { type: "string", example: "ok" },
            },
          },
        },
      },
    },
    async () => ({
      service: "ingestion",
      status: "ok",
      mongo: !isMongoConfigured()
        ? "skipped"
        : isMongoConnected()
          ? "ok"
          : "down",
    }),
  );
}
