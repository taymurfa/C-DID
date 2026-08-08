import { z } from "zod";

/**
 * Input contract: mirrors the `IngestionResult` produced by Agent 1
 * (speaker-signal-ingestion). Kept permissive with defaults so Person 2 tolerates
 * partial upstream data without throwing.
 */

/** Accept absolute URLs; coerce blank/relative values to a placeholder. */
const LooseUrlSchema = z.preprocess((value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "https://example.com/unknown";
  }
  try {
    return new URL(value).href;
  } catch {
    return "https://example.com/unknown";
  }
}, z.string().url());

export const RawConferenceSchema = z.object({
  name: z.string().nullable().default(null),
  websiteUrl: LooseUrlSchema,
  startDate: z.string().nullable().default(null),
  endDate: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
});

export const RawSessionSchema = z.object({
  sourceId: z.string(),
  title: z.string(),
  description: z.string().nullable().default(null),
  startTime: z.string().nullable().default(null),
  endTime: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  topics: z.array(z.string()).default([]),
  sourceUrl: LooseUrlSchema,
  sourceUrls: z.array(LooseUrlSchema).default([]),
  speakerSourceIds: z.array(z.string()).default([]),
  extractionConfidence: z.number().min(0).max(1).default(0.5),
});

export const RawSpeakerSchema = z.object({
  sourceId: z.string(),
  name: z.string(),
  title: z.string().nullable().default(null),
  company: z.string().nullable().default(null),
  bio: z.string().nullable().default(null),
  linkedinUrl: z.string().nullable().optional(),
  role: z
    .enum([
      "speaker",
      "moderator",
      "sponsor",
      "staff",
      "exhibitor",
      "journalist",
      "unknown",
    ])
    .default("speaker"),
  topics: z.array(z.string()).default([]),
  sourceUrl: LooseUrlSchema,
  sourceUrls: z.array(LooseUrlSchema).default([]),
  sessionSourceIds: z.array(z.string()).default([]),
  extractionConfidence: z.number().min(0).max(1).default(0.5),
});

export const IngestionResultSchema = z.object({
  runId: z.string().default("unknown-run"),
  conference: RawConferenceSchema,
  sessions: z.array(RawSessionSchema).default([]),
  speakers: z.array(RawSpeakerSchema).default([]),
  // These upstream fields are accepted but not required by Person 2.
  coverage: z.unknown().optional(),
  pages: z.unknown().optional(),
  discoveredEvents: z.unknown().optional(),
  errors: z.unknown().optional(),
});

export type RawConference = z.infer<typeof RawConferenceSchema>;
export type RawSession = z.infer<typeof RawSessionSchema>;
export type RawSpeaker = z.infer<typeof RawSpeakerSchema>;
export type IngestionResult = z.infer<typeof IngestionResultSchema>;
