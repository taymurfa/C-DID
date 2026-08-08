import { extractLinks } from "../crawler/discoverPages.js";
import type { DiscoveredEvent } from "../schemas/event.js";
import { classifyEvents, type LinkCandidate } from "./reason.js";
import { looksLikeEventLink } from "./signals.js";

/** Extract an event/edition slug from a URL, e.g. ".../events/2026-nashville/x" -> "2026-nashville". */
function eventSlug(url: string): string | null {
  const m = url.toLowerCase().match(/\/events?\/([^/]+)/);
  return m ? m[1] : null;
}

/**
 * Find candidate related/future conference editions on a page (event index
 * pages, "View 2027 event" links, other editions from the same organizer),
 * then classify them with OpenAI (or a heuristic fallback).
 *
 * `currentUrl` is excluded and any year matching the current edition is
 * de-emphasized so we surface *other* editions.
 */
export async function discoverEvents(
  html: string,
  baseUrl: string,
  currentUrl: string,
  limit = 12,
): Promise<DiscoveredEvent[]> {
  const currentSlug = eventSlug(currentUrl);
  const candidatesMap = new Map<string, LinkCandidate>();

  for (const link of extractLinks(html, baseUrl)) {
    if (link.url === currentUrl) continue;
    if (!looksLikeEventLink(link.url, link.text)) continue;

    // Skip links that point at the same edition we're already crawling (same
    // slug), but keep other cities/years from the same organizer.
    const slug = eventSlug(link.url);
    if (currentSlug && slug === currentSlug) continue;

    if (!candidatesMap.has(link.url)) {
      candidatesMap.set(link.url, { url: link.url, text: link.text });
    }
  }

  const candidates = [...candidatesMap.values()].slice(0, limit);
  if (candidates.length === 0) return [];

  const classified = await classifyEvents(candidates);

  // Deduplicate by URL, keeping the highest-confidence classification.
  const byUrl = new Map<string, DiscoveredEvent>();
  for (const event of classified) {
    const existing = byUrl.get(event.eventUrl);
    if (!existing || event.confidence > existing.confidence) {
      byUrl.set(event.eventUrl, event);
    }
  }
  return [...byUrl.values()];
}
