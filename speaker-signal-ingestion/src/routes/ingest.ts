import type { FastifyInstance } from "fastify";
import { enqueueDiscovered } from "../ingest/autoIngestQueue.js";
import { runIngestion } from "../ingest/runIngestion.js";
import { IngestRequestSchema } from "../schemas/ingestion.js";

const speakerSchema = {
  type: "object",
  required: [
    "sourceId",
    "name",
    "role",
    "sourceUrl",
    "sourceUrls",
    "sessionSourceIds",
    "extractionConfidence",
  ],
  properties: {
    sourceId: { type: "string" },
    name: { type: "string" },
    title: { type: "string", nullable: true },
    company: { type: "string", nullable: true },
    bio: { type: "string", nullable: true },
    role: {
      type: "string",
      enum: [
        "speaker",
        "moderator",
        "sponsor",
        "staff",
        "exhibitor",
        "journalist",
        "unknown",
      ],
    },
    topics: { type: "array", items: { type: "string" } },
    sourceUrl: { type: "string" },
    sourceUrls: { type: "array", items: { type: "string" } },
    sessionSourceIds: { type: "array", items: { type: "string" } },
    extractionConfidence: { type: "number" },
  },
} as const;

const sessionSchema = {
  type: "object",
  required: [
    "sourceId",
    "title",
    "sourceUrl",
    "sourceUrls",
    "speakerSourceIds",
    "extractionConfidence",
  ],
  properties: {
    sourceId: { type: "string" },
    title: { type: "string" },
    description: { type: "string", nullable: true },
    startTime: { type: "string", nullable: true },
    endTime: { type: "string", nullable: true },
    location: { type: "string", nullable: true },
    topics: { type: "array", items: { type: "string" } },
    sourceUrl: { type: "string" },
    sourceUrls: { type: "array", items: { type: "string" } },
    speakerSourceIds: { type: "array", items: { type: "string" } },
    extractionConfidence: { type: "number" },
  },
} as const;

const pageSchema = {
  type: "object",
  required: ["url", "pageType", "contentHash", "fetchedAt"],
  properties: {
    url: { type: "string" },
    pageType: {
      type: "string",
      enum: [
        "overview",
        "agenda",
        "speakers",
        "session",
        "profile",
        "series",
        "unknown",
      ],
    },
    contentHash: { type: "string" },
    fetchedAt: { type: "string" },
    changed: { type: "boolean", nullable: true },
  },
} as const;

const coverageSchema = {
  type: "object",
  properties: {
    hasConferenceDates: { type: "boolean" },
    hasConferenceLocation: { type: "boolean" },
    hasAgenda: { type: "boolean" },
    hasSessionTitles: { type: "boolean" },
    hasSpeakerNames: { type: "boolean" },
    hasSpeakerTitles: { type: "boolean" },
    hasSpeakerCompanies: { type: "boolean" },
    hasSpeakerSessionLinks: { type: "boolean" },
  },
} as const;

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

const conferenceSchema = {
  type: "object",
  required: ["name", "websiteUrl", "startDate", "endDate", "location"],
  properties: {
    name: { type: "string", nullable: true },
    websiteUrl: { type: "string" },
    startDate: { type: "string", nullable: true },
    endDate: { type: "string", nullable: true },
    location: { type: "string", nullable: true },
  },
} as const;

const ingestionResultSchema = {
  type: "object",
  required: [
    "runId",
    "conference",
    "coverage",
    "pages",
    "sessions",
    "speakers",
    "discoveredEvents",
    "errors",
  ],
  properties: {
    runId: { type: "string" },
    conference: conferenceSchema,
    coverage: coverageSchema,
    pages: { type: "array", items: pageSchema },
    sessions: { type: "array", items: sessionSchema },
    speakers: { type: "array", items: speakerSchema },
    discoveredEvents: { type: "array", items: discoveredEventSchema },
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
} as const;

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/ingest",
    {
      schema: {
        summary: "Ingest a conference URL into structured public data",
        description:
          "Discovers useful pages, fetches public content, and returns structured " +
          "conference info (sessions + speakers). One bad page never fails the run; " +
          "partial results are returned alongside an `errors` array.",
        tags: ["ingestion"],
        body: {
          type: "object",
          required: ["conferenceUrl"],
          properties: {
            conferenceUrl: {
              type: "string",
              format: "uri",
              example: "https://example.com",
            },
            maxPages: {
              type: "integer",
              minimum: 1,
              maximum: 40,
              description: "Optional cap on pages crawled (default from env).",
            },
            discoverEvents: {
              type: "boolean",
              description: "Also discover related/future events (default true).",
            },
          },
        },
        response: {
          200: ingestionResultSchema,
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              details: {},
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = IngestRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid request body",
          details: parsed.error.flatten(),
        });
      }

      const result = await runIngestion(parsed.data.conferenceUrl);

      // Event-driven trigger: conferences discovered while ingesting this one
      // are "new conferences added" - auto-enqueue the relevant ones (at depth
      // 1, so the chain stays bounded by AUTO_INGEST_MAX_DEPTH).
      const autoIngestQueued = enqueueDiscovered(result.discoveredEvents, 1);
      if (autoIngestQueued > 0) {
        request.log.info(
          { autoIngestQueued, runId: result.runId },
          "auto-ingest: enqueued conferences discovered during ingestion",
        );
      }

      return reply.status(200).send(result);
    },
  );
}
