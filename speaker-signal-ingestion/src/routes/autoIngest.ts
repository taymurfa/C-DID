import type { FastifyInstance } from "fastify";
import { autoIngestStats } from "../ingest/autoIngestQueue.js";

export async function autoIngestRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/auto-ingest",
    {
      schema: {
        summary: "Inspect the event-driven auto-ingestion queue",
        description:
          "Reports whether auto-ingestion is enabled and live counters for the " +
          "background queue that ingests newly discovered conferences.",
        tags: ["system"],
        response: {
          200: {
            type: "object",
            required: [
              "enabled",
              "enqueued",
              "completed",
              "failed",
              "skipped",
              "active",
              "pending",
            ],
            properties: {
              enabled: { type: "boolean" },
              enqueued: { type: "integer" },
              completed: { type: "integer" },
              failed: { type: "integer" },
              skipped: { type: "integer" },
              active: { type: "integer" },
              pending: { type: "integer" },
            },
          },
        },
      },
    },
    async () => autoIngestStats(),
  );
}
