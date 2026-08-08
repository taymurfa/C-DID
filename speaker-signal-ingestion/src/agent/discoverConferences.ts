import { fetchPage } from "../crawler/fetchPage.js";
import { normalizeUrl } from "../crawler/normalizeUrl.js";
import type { DiscoveredEvent } from "../schemas/event.js";
import type { DiscoverResult } from "../schemas/discover.js";
import type { IngestionError } from "../schemas/ingestion.js";
import { discoverEvents } from "./discoverEvents.js";

export interface DiscoverConferencesOptions {
  maxPerSeed?: number;
}

/**
 * Cold-start conference discovery: given seed pages (organizer sites, event
 * index/listing pages), fetch each and surface candidate conference editions,
 * classified for relevance (energy/data-center/infrastructure themes) by the
 * OpenAI reasoning layer, with a deterministic fallback. One bad seed never
 * fails the whole request.
 */
export async function discoverConferences(
  seedUrls: string[],
  options: DiscoverConferencesOptions = {},
): Promise<DiscoverResult> {
  const maxPerSeed = options.maxPerSeed ?? 20;
  const errors: IngestionError[] = [];
  const byUrl = new Map<string, DiscoveredEvent>();
  let pagesFetched = 0;

  for (const seed of seedUrls) {
    const url = normalizeUrl(seed) ?? seed;
    try {
      const fetched = await fetchPage(url);
      pagesFetched += 1;
      const events = await discoverEvents(
        fetched.html,
        fetched.finalUrl,
        fetched.finalUrl,
        maxPerSeed,
      );
      for (const event of events) {
        const existing = byUrl.get(event.eventUrl);
        if (!existing || event.confidence > existing.confidence) {
          byUrl.set(event.eventUrl, event);
        }
      }
    } catch (err) {
      errors.push({
        url,
        stage: "discover",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const discoveredEvents = [...byUrl.values()].sort(
    (a, b) => b.confidence - a.confidence,
  );

  return { discoveredEvents, pagesFetched, errors };
}
