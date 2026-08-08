import type { FastifyInstance } from "fastify";
import { discoverConferences } from "../agent/discoverConferences.js";
import { enqueueDiscovered } from "../ingest/autoIngestQueue.js";
import { DiscoverRequestSchema } from "../schemas/discover.js";

const discoveredEventSchema = {
  type: "object",
  required: ["eventName", "eventUrl", "isRelevantConference", "confidence"],
  properties: {
    eventName: { type: "string" },
    eventUrl: { type: "string" },
    isRelevantConference: { type: "boolean" },
    confidence: { type: "number" },
    reason: { type: "string", nullable: true },
    startDate: { type: "string", nullable: true },
  },
} as const;

export async function discoverRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/discover",
    {
      schema: {
        summary: "Cold-start discovery of related conferences from seed pages",
        description:
          "Given seed pages (organizer sites, event index/listing pages), find " +
          "candidate conference editions and classify their relevance to " +
          "energy/data-center/infrastructure themes. Use this to expand the " +
          "conference universe before running /ingest on a specific event.",
        tags: ["discovery"],
        body: {
          type: "object",
          required: ["seedUrls"],
          properties: {
            seedUrls: {
              type: "array",
              items: { type: "string", format: "uri" },
              minItems: 1,
              maxItems: 10,
              example: ["https://devopsdays.org/events/"],
            },
            maxPerSeed: { type: "integer", minimum: 1, maximum: 50 },
          },
        },
        response: {
          200: {
          type: "object",
              required: ["discoveredEvents", "pagesFetched", "errors"],
              properties: {
                discoveredEvents: {
                  type: "array",
                  items: discoveredEventSchema,
                },
                autoIngestQueued: {
                  type: "integer",
                  description:
                    "How many relevant discovered conferences were auto-enqueued " +
                    "for background ingestion (0 when auto-ingest is disabled).",
                },
                pagesFetched: { type: "integer" },
              errors: {
                type: "array",
                items: {
                  type: "object",
                  required: ["url", "stage", "message"],
                  properties: {
                    url: { type: "string" },
                    stage: {
                      type: "string",
                      enum: ["fetch", "parse", "extract", "discover", "classify"],
                    },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: { error: { type: "string" }, details: {} },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = DiscoverRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid request body",
          details: parsed.error.flatten(),
        });
      }

      const result = await discoverConferences(parsed.data.seedUrls, {
        maxPerSeed: parsed.data.maxPerSeed,
      });

      // Event-driven trigger: a freshly discovered conference is a "new
      // conference added". Auto-enqueue the relevant ones for ingestion.
      const autoIngestQueued = enqueueDiscovered(result.discoveredEvents, 0);
      if (autoIngestQueued > 0) {
        request.log.info(
          { autoIngestQueued },
          "auto-ingest: enqueued discovered conferences",
        );
      }

      return reply.status(200).send({ ...result, autoIngestQueued });
    },
  );
}
