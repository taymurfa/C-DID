import type { FastifyInstance } from "fastify";
import { runQualification } from "../qualify/runQualification.js";
import { saveQualification } from "../db/mongo.js";
import { QualifyRequestSchema } from "../schemas/lead.js";

export async function qualifyRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/qualify",
    {
      schema: {
        summary: "Turn scraped conference data into ranked qualified leads",
        description:
          "Accepts Agent 1's ingestion output (either the full object, or wrapped " +
          "under `ingestion`). Cleans and normalizes names/companies/titles, " +
          "deduplicates speakers and companies, scores ICP fit (OpenAI when " +
          "configured, deterministic otherwise), and returns leads ranked by a " +
          "blended score with a 'why this person matters' explanation and evidence.",
        tags: ["intelligence"],
        body: {
          type: "object",
          additionalProperties: true,
          properties: {
            ingestion: {
              type: "object",
              additionalProperties: true,
              description: "Full Agent 1 IngestionResult (optional wrapper).",
            },
            speakers: {
              type: "array",
              description: "Scraped speakers (used when `ingestion` is omitted).",
              items: { type: "object", additionalProperties: true },
            },
            sessions: {
              type: "array",
              items: { type: "object", additionalProperties: true },
            },
            conference: { type: "object", additionalProperties: true },
            runId: { type: "string" },
            minScore: {
              type: "number",
              minimum: 0,
              maximum: 100,
              description: "Override the qualification threshold (default 45).",
            },
            useOpenAi: {
              type: "boolean",
              description:
                "Set false to force deterministic scoring even if OpenAI is configured.",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;

      const optionsParse = QualifyRequestSchema.safeParse(body);
      const options = optionsParse.success
        ? {
            minScore: optionsParse.data.minScore,
            useOpenAi: optionsParse.data.useOpenAi,
          }
        : {};

      // Accept either a nested `ingestion` object or the bare fields at top level.
      const ingestionPayload =
        body.ingestion && typeof body.ingestion === "object"
          ? body.ingestion
          : body;

      const result = await runQualification(ingestionPayload, options);
      await saveQualification(result);
      return reply.status(200).send(result);
    },
  );
}
