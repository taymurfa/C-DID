import type { FastifyInstance } from "fastify";
import { isMongoConfigured, isMongoConnected } from "../db/mongo.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        summary: "Liveness check",
        tags: ["system"],
      },
    },
    async () => ({
      service: "project-radar-score",
      status: "ok",
      mongo: !isMongoConfigured()
        ? "skipped"
        : isMongoConnected()
          ? "ok"
          : "down",
    }),
  );
}
