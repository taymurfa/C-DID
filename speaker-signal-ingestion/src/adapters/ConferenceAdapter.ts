import type { ParsedPage } from "../schemas/ingestion.js";

/**
 * A ConferenceAdapter knows how to discover useful pages and parse a single
 * page for a particular family of conference sites. The GenericConferenceAdapter
 * is the default; site-specific adapters can be added later without changing
 * the crawl/orchestration code.
 */
export interface ConferenceAdapter {
  /** Whether this adapter should handle the given conference URL. */
  matches(url: string): boolean;

  /** Return same-site candidate URLs worth fetching, ranked/bounded. */
  discoverPages(html: string, baseUrl: string): Promise<string[]>;

  /** Parse a single fetched page into structured conference data. */
  parsePage(html: string, url: string): Promise<ParsedPage>;
}
