import { z } from "zod";
import { ConferenceSchema } from "./conference.js";
import { CoverageSchema } from "./coverage.js";
import { DiscoveredEventSchema } from "./event.js";
import { PageSchema } from "./page.js";
import { SessionSchema } from "./session.js";
import { SpeakerSchema } from "./speaker.js";

export const IngestRequestSchema = z.object({
  conferenceUrl: z.string().url(),
  // Optional overrides for the agentic loop (all bounded server-side).
  maxPages: z.number().int().positive().max(40).optional(),
  discoverEvents: z.boolean().optional(),
});

export type IngestRequest = z.infer<typeof IngestRequestSchema>;

export const IngestionErrorSchema = z.object({
  url: z.string(),
  stage: z.enum(["fetch", "parse", "extract", "discover", "classify"]),
  message: z.string(),
});

export type IngestionError = z.infer<typeof IngestionErrorSchema>;

export const IngestionResultSchema = z.object({
  runId: z.string(),
  conference: ConferenceSchema,
  coverage: CoverageSchema,
  pages: z.array(PageSchema),
  sessions: z.array(SessionSchema),
  speakers: z.array(SpeakerSchema),
  discoveredEvents: z.array(DiscoveredEventSchema),
  errors: z.array(IngestionErrorSchema),
});

export type IngestionResult = z.infer<typeof IngestionResultSchema>;

/**
 * The result of parsing a single page: metadata plus any conference-level
 * fields, sessions, and speakers discovered on that page.
 */
export interface ParsedPage {
  page: z.infer<typeof PageSchema>;
  conference: Partial<z.infer<typeof ConferenceSchema>>;
  sessions: z.infer<typeof SessionSchema>[];
  speakers: z.infer<typeof SpeakerSchema>[];
}
