import { z } from "zod";
import { DiscoveredEventSchema } from "./event.js";
import { IngestionErrorSchema } from "./ingestion.js";

export const DiscoverRequestSchema = z.object({
  // Seed pages to scan for conference/event links (organizer sites, event
  // index/listing pages, "past events" pages, etc.).
  seedUrls: z.array(z.string().url()).min(1).max(10),
  maxPerSeed: z.number().int().positive().max(50).optional(),
});

export type DiscoverRequest = z.infer<typeof DiscoverRequestSchema>;

export const DiscoverResultSchema = z.object({
  discoveredEvents: z.array(DiscoveredEventSchema),
  pagesFetched: z.number().int(),
  errors: z.array(IngestionErrorSchema),
});

export type DiscoverResult = z.infer<typeof DiscoverResultSchema>;
