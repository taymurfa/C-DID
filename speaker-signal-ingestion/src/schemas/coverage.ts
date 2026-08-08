import { z } from "zod";

/**
 * Agent 1's self-assessment of what it has found so far. The agentic loop uses
 * this to decide whether to keep crawling and which page types to seek next.
 */
export const CoverageSchema = z.object({
  hasConferenceDates: z.boolean(),
  hasConferenceLocation: z.boolean(),
  hasAgenda: z.boolean(),
  hasSessionTitles: z.boolean(),
  hasSpeakerNames: z.boolean(),
  hasSpeakerTitles: z.boolean(),
  hasSpeakerCompanies: z.boolean(),
  hasSpeakerSessionLinks: z.boolean(),
});

export type Coverage = z.infer<typeof CoverageSchema>;

export const EMPTY_COVERAGE: Coverage = {
  hasConferenceDates: false,
  hasConferenceLocation: false,
  hasAgenda: false,
  hasSessionTitles: false,
  hasSpeakerNames: false,
  hasSpeakerTitles: false,
  hasSpeakerCompanies: false,
  hasSpeakerSessionLinks: false,
};
