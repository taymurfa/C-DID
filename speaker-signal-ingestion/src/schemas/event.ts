import { z } from "zod";

/**
 * A related/future conference edition discovered while crawling (e.g. an event
 * index page or a "View 2027 event" link). Agent 1 surfaces these so the system
 * can expand its conference universe over time.
 */
export const DiscoveredEventSchema = z.object({
  eventName: z.string(),
  eventUrl: z.string().url(),
  isRelevantConference: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().nullable(),
  startDate: z.string().nullable(),
});

export type DiscoveredEvent = z.infer<typeof DiscoveredEventSchema>;
