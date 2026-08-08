import { z } from "zod";
import { chatJson, isOpenAiEnabled } from "../extract/openaiClient.js";
import type { DiscoveredEvent } from "../schemas/event.js";
import type { PageType } from "../schemas/page.js";
import { classifyPageTypeByUrl, detectYear } from "./signals.js";

/**
 * OpenAI is the reasoning layer. Each function here uses the model to answer a
 * narrow question ("is this an agenda?", "which links hold speakers?", "is this
 * a relevant future event?") and falls back to deterministic heuristics when
 * OpenAI is unavailable. None of these invent conference facts.
 */

const PAGE_TYPES: PageType[] = [
  "overview",
  "agenda",
  "speakers",
  "session",
  "profile",
  "series",
  "unknown",
];

const PageClassSchema = z.object({
  pageType: z.enum([
    "overview",
    "agenda",
    "speakers",
    "session",
    "profile",
    "series",
    "unknown",
  ]),
});

/** Classify a page's type from its text, using OpenAI when configured. */
export async function classifyPage(
  url: string,
  title: string | null,
  text: string,
): Promise<PageType> {
  const deterministic = classifyPageTypeByUrl(url, title ?? "");
  if (!isOpenAiEnabled()) return deterministic;

  const raw = await chatJson(
    "You classify conference web pages. Return JSON {\"pageType\": one of " +
      `${PAGE_TYPES.join(", ")}}. "series" means an event/edition index listing ` +
      "multiple conferences. Base it on the actual content.",
    `URL: ${url}\nTITLE: ${title ?? ""}\nTEXT (truncated):\n${text.slice(0, 3000)}`,
    100,
  );
  const parsed = PageClassSchema.safeParse(raw);
  return parsed.success ? parsed.data.pageType : deterministic;
}

const LinkRankSchema = z.object({
  urls: z.array(z.string()),
});

export interface LinkCandidate {
  url: string;
  text: string;
}

/**
 * Ask OpenAI which candidate links are most likely to satisfy the current
 * information gaps. Returns an ordered subset of URLs. Falls back to the input
 * order (already deterministically scored) when OpenAI is unavailable.
 */
export async function prioritizeLinks(
  candidates: LinkCandidate[],
  gaps: string[],
  limit: number,
): Promise<string[]> {
  const fallback = candidates.slice(0, limit).map((c) => c.url);
  if (!isOpenAiEnabled() || candidates.length <= limit) return fallback;

  const raw = await chatJson(
    "You help a conference crawler choose which links to follow next. " +
      "Given information gaps and a list of links, return JSON " +
      '{"urls": [...]} with the most promising URLs first (only URLs from the ' +
      "input). Prefer links likely to contain agenda, sessions, speakers, " +
      "titles, and companies. Avoid tickets, sponsors, privacy, login.",
    `GAPS: ${gaps.join(", ") || "none"}\nLINKS:\n${candidates
      .map((c, i) => `${i + 1}. ${c.url}  |  ${c.text.slice(0, 80)}`)
      .join("\n")}`,
    800,
  );
  const parsed = LinkRankSchema.safeParse(raw);
  if (!parsed.success) return fallback;

  const allowed = new Set(candidates.map((c) => c.url));
  const ranked = parsed.data.urls.filter((u) => allowed.has(u));
  // Append any candidates the model omitted so nothing is silently lost.
  for (const c of candidates) if (!ranked.includes(c.url)) ranked.push(c.url);
  return ranked.slice(0, limit);
}

const EventClassSchema = z.object({
  events: z.array(
    z.object({
      eventName: z.string(),
      eventUrl: z.string(),
      isRelevantConference: z.boolean(),
      confidence: z.number().min(0).max(1),
      reason: z.string().nullable().optional(),
      startDate: z.string().nullable().optional(),
    }),
  ),
});

/**
 * Classify candidate event links (from an index / "view 20XX event" links) as
 * relevant conferences or not. Deterministic fallback marks everything with a
 * modest confidence based on theme keywords.
 */
export async function classifyEvents(
  candidates: LinkCandidate[],
): Promise<DiscoveredEvent[]> {
  if (candidates.length === 0) return [];

  if (!isOpenAiEnabled()) {
    return candidates.map((c) => ({
      eventName: c.text || c.url,
      eventUrl: c.url,
      isRelevantConference: true,
      confidence: 0.4,
      reason: "Heuristic: looks like a conference/event link",
      startDate:
        detectYear(`${c.url} ${c.text}`) !== null
          ? `${detectYear(`${c.url} ${c.text}`)}`
          : null,
    }));
  }

  const raw = await chatJson(
    "You classify links as conference/event editions. Themes of interest: " +
      "data centers, power, energy, grid, interconnection, utilities, " +
      "infrastructure, development, AI infrastructure, microgrids, gas/LNG, " +
      "renewables. Return JSON {\"events\": [{eventName, eventUrl, " +
      "isRelevantConference, confidence (0-1), reason, startDate|null}]}. " +
      "Only use URLs from the input. Do not invent dates.",
    `CANDIDATE LINKS:\n${candidates
      .map((c, i) => `${i + 1}. ${c.url}  |  ${c.text.slice(0, 100)}`)
      .join("\n")}`,
    1500,
  );
  const parsed = EventClassSchema.safeParse(raw);
  if (!parsed.success) return [];

  const allowed = new Set(candidates.map((c) => c.url));
  return parsed.data.events
    .filter((e) => allowed.has(e.eventUrl))
    .map((e) => ({
      eventName: e.eventName,
      eventUrl: e.eventUrl,
      isRelevantConference: e.isRelevantConference,
      confidence: e.confidence,
      reason: e.reason ?? null,
      startDate: e.startDate ?? null,
    }));
}
