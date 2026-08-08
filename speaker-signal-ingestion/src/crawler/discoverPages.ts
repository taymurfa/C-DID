import * as cheerio from "cheerio";
import type { PageType } from "../schemas/page.js";
import {
  NON_HTML_EXT,
  classifyPageTypeByUrl,
  scoreLink,
} from "../agent/signals.js";
import { normalizeUrl, sameSite } from "./normalizeUrl.js";

export interface RawLink {
  url: string;
  text: string;
}

export interface DiscoveredLink {
  url: string;
  text: string;
  score: number;
  pageType: PageType;
}

/** Best-effort classification of a page from its URL + anchor text. */
export function classifyPageType(url: string, text = ""): PageType {
  return classifyPageTypeByUrl(url, text);
}

/**
 * Extract every same-site, non-asset link from a page along with its anchor
 * text. No scoring or filtering - this is the raw candidate set used by both
 * page discovery and event discovery.
 */
export function extractLinks(html: string, baseUrl: string): RawLink[] {
  const $ = cheerio.load(html);
  const seen = new Map<string, string>();
  const self = normalizeUrl(baseUrl);

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

    const normalized = normalizeUrl(href, baseUrl);
    if (!normalized) return;
    if (NON_HTML_EXT.test(new URL(normalized).pathname)) return;
    if (!sameSite(normalized, baseUrl)) return;
    if (normalized === self) return;

    const text = $(el).text().replace(/\s+/g, " ").trim();
    const existing = seen.get(normalized);
    if (!existing || (!existing.length && text.length)) {
      seen.set(normalized, text);
    }
  });

  return [...seen.entries()].map(([url, text]) => ({ url, text }));
}

/**
 * Extract same-site, likely-useful links ranked by deterministic relevance.
 * Hard-excluded junk (privacy, tickets, login, ...) is dropped. Results are
 * bounded by `limit`.
 */
export function discoverPages(
  html: string,
  baseUrl: string,
  limit = 12,
): DiscoveredLink[] {
  const links = extractLinks(html, baseUrl);
  const scored: DiscoveredLink[] = [];

  for (const { url, text } of links) {
    const score = scoreLink(url, text);
    if (score < 0) continue;
    scored.push({ url, text, score, pageType: classifyPageType(url, text) });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
