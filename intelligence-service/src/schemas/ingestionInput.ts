import { z } from "zod";

/**
 * Agent 2's view of Agent 1's output. We intentionally keep this LENIENT: the
 * intelligence service must ingest partial/noisy scraped data without rejecting
 * the whole payload. Missing optional fields default to safe values, and
 * unknown extra keys are ignored. The strict producer-side contract lives in
 * the ingestion service (`speaker-signal-ingestion`).
 */

export const PersonRoleSchema = z
  .enum([
    "speaker",
    "moderator",
    "sponsor",
    "staff",
    "exhibitor",
    "journalist",
    "unknown",
  ])
  .catch("unknown");

export type PersonRole = z.infer<typeof PersonRoleSchema>;

export const InputSpeakerSchema = z.object({
  sourceId: z.string(),
  name: z.string(),
  title: z.string().nullish().default(null),
  company: z.string().nullish().default(null),
  bio: z.string().nullish().default(null),
  role: PersonRoleSchema.default("speaker"),
  topics: z.array(z.string()).default([]),
  sourceUrl: z.string().optional(),
  sourceUrls: z.array(z.string()).default([]),
  sessionSourceIds: z.array(z.string()).default([]),
  extractionConfidence: z.number().min(0).max(1).default(0.5),
});

export type InputSpeaker = z.infer<typeof InputSpeakerSchema>;

export const InputSessionSchema = z.object({
  sourceId: z.string(),
  title: z.string(),
  description: z.string().nullish().default(null),
  startTime: z.string().nullish().default(null),
  endTime: z.string().nullish().default(null),
  location: z.string().nullish().default(null),
  topics: z.array(z.string()).default([]),
  sourceUrl: z.string().optional(),
  sourceUrls: z.array(z.string()).default([]),
  speakerSourceIds: z.array(z.string()).default([]),
  extractionConfidence: z.number().min(0).max(1).default(0.5),
});

export type InputSession = z.infer<typeof InputSessionSchema>;

export const InputConferenceSchema = z
  .object({
    name: z.string().nullish().default(null),
    websiteUrl: z.string().optional(),
    startDate: z.string().nullish().default(null),
    endDate: z.string().nullish().default(null),
    location: z.string().nullish().default(null),
  })
  .partial();

export type InputConference = z.infer<typeof InputConferenceSchema>;

/**
 * The full ingestion payload. Only `speakers` is truly required to do useful
 * work; everything else is optional so callers can post trimmed payloads.
 */
export const IngestionInputSchema = z.object({
  runId: z.string().optional(),
  conference: InputConferenceSchema.optional(),
  sessions: z.array(InputSessionSchema).default([]),
  speakers: z.array(InputSpeakerSchema).default([]),
});

export type IngestionInput = z.infer<typeof IngestionInputSchema>;
