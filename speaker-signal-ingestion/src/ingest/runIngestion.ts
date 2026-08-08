import { v4 as uuidv4 } from "uuid";
import { genericConferenceAdapter } from "../adapters/GenericConferenceAdapter.js";
import type { ConferenceAdapter } from "../adapters/ConferenceAdapter.js";
import {
  computeCoverage,
  desiredPageTypes,
  describeGaps,
  isCoverageComplete,
} from "../agent/coverage.js";
import { discoverEvents } from "../agent/discoverEvents.js";
import { prioritizeLinks } from "../agent/reason.js";
import { classifyPageTypeByUrl, scoreLink } from "../agent/signals.js";
import { env } from "../config/env.js";
import { discoverPages } from "../crawler/discoverPages.js";
import { fetchPage } from "../crawler/fetchPage.js";
import { normalizeUrl } from "../crawler/normalizeUrl.js";
import { isOpenAiEnabled } from "../extract/openaiClient.js";
import { getPreviousRun, saveRun } from "../db/mongo.js";
import type { Conference } from "../schemas/conference.js";
import { EMPTY_COVERAGE, type Coverage } from "../schemas/coverage.js";
import type { DiscoveredEvent } from "../schemas/event.js";
import type {
  IngestionError,
  IngestionResult,
  ParsedPage,
} from "../schemas/ingestion.js";
import type { Page } from "../schemas/page.js";
import type { Session } from "../schemas/session.js";
import type { Speaker } from "../schemas/speaker.js";

const ADAPTERS: ConferenceAdapter[] = [genericConferenceAdapter];

const LINKS_PER_PAGE = 8;
const EVENT_CLASSIFY_BUDGET = 3;

function pickAdapter(url: string): ConferenceAdapter {
  return ADAPTERS.find((a) => a.matches(url)) ?? genericConferenceAdapter;
}

function mergeConference(
  base: Conference,
  update: Partial<Conference>,
): Conference {
  return {
    name: base.name ?? update.name ?? null,
    websiteUrl: base.websiteUrl,
    startDate: base.startDate ?? update.startDate ?? null,
    endDate: base.endDate ?? update.endDate ?? null,
    location: base.location ?? update.location ?? null,
  };
}

function mergeLinks(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming])];
}

interface FrontierItem {
  url: string;
  text: string;
  baseScore: number;
}

export interface RunIngestionOptions {
  /** Skip network (used by tests): parse only the provided seed HTML. */
  seedHtml?: string;
  persist?: boolean;
  maxPages?: number;
  discoverEvents?: boolean;
}

/**
 * Agent 1's agentic ingestion loop. It fetches the starting page, classifies
 * it, extracts conference facts, then repeatedly asks "what am I missing?" and
 * chooses the next highest-value page to crawl (rather than crawling blindly).
 * It also surfaces related/future events. One bad page never fails the run.
 */
export async function runIngestion(
  conferenceUrl: string,
  options: RunIngestionOptions = {},
): Promise<IngestionResult> {
  const runId = uuidv4();
  const rootUrl = normalizeUrl(conferenceUrl) ?? conferenceUrl;
  const adapter = pickAdapter(rootUrl);
  const maxPages = Math.min(options.maxPages ?? env.crawl.maxPages, 40);
  const wantEvents = options.discoverEvents ?? true;

  const errors: IngestionError[] = [];
  const pages: Page[] = [];
  const sessionsById = new Map<string, Session>();
  const speakersById = new Map<string, Speaker>();
  const discoveredEvents = new Map<string, DiscoveredEvent>();

  let conference: Conference = {
    name: null,
    websiteUrl: rootUrl,
    startDate: null,
    endDate: null,
    location: null,
  };

  const absorb = (parsed: ParsedPage) => {
    conference = mergeConference(conference, parsed.conference);

    for (const session of parsed.sessions) {
      const existing = sessionsById.get(session.sourceId);
      if (existing) {
        existing.speakerSourceIds = mergeLinks(
          existing.speakerSourceIds,
          session.speakerSourceIds,
        );
        existing.sourceUrls = mergeLinks(existing.sourceUrls, session.sourceUrls);
        existing.topics = mergeLinks(existing.topics, session.topics);
        existing.description = existing.description ?? session.description;
        existing.startTime = existing.startTime ?? session.startTime;
        existing.endTime = existing.endTime ?? session.endTime;
        existing.location = existing.location ?? session.location;
      } else {
        sessionsById.set(session.sourceId, { ...session });
      }
    }

    for (const speaker of parsed.speakers) {
      const existing = speakersById.get(speaker.sourceId);
      if (existing) {
        existing.sessionSourceIds = mergeLinks(
          existing.sessionSourceIds,
          speaker.sessionSourceIds,
        );
        existing.sourceUrls = mergeLinks(existing.sourceUrls, speaker.sourceUrls);
        existing.topics = mergeLinks(existing.topics, speaker.topics);
        existing.title = existing.title ?? speaker.title;
        existing.company = existing.company ?? speaker.company;
        existing.bio = existing.bio ?? speaker.bio;
        existing.linkedinUrl = existing.linkedinUrl ?? speaker.linkedinUrl;
        existing.extractionConfidence = Math.max(
          existing.extractionConfidence,
          speaker.extractionConfidence,
        );
      } else {
        speakersById.set(speaker.sourceId, { ...speaker });
      }
    }
  };

  const state = () => ({
    conference,
    sessions: [...sessionsById.values()],
    speakers: [...speakersById.values()],
  });

  // --- Test / offline path: parse a single seed HTML, no network ----------
  if (options.seedHtml !== undefined) {
    try {
      const parsed = await adapter.parsePage(options.seedHtml, rootUrl);
      pages.push(parsed.page);
      absorb(parsed);
    } catch (err) {
      errors.push({
        url: rootUrl,
        stage: "parse",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return finalize(
      runId,
      conference,
      pages,
      sessionsById,
      speakersById,
      discoveredEvents,
      errors,
      options,
    );
  }

  // --- Agentic crawl loop -------------------------------------------------
  const visited = new Set<string>();
  const frontier: FrontierItem[] = [];
  const enqueued = new Set<string>();
  let eventBudget = wantEvents ? EVENT_CLASSIFY_BUDGET : 0;

  const enqueueFromPage = async (html: string, fromUrl: string) => {
    // Deterministic discovery + scoring first (cheap filter).
    const candidates = discoverPages(html, fromUrl, 30).filter(
      (l) => !visited.has(l.url) && !enqueued.has(l.url),
    );

    // OpenAI link prioritization when there are many candidates.
    let chosen = candidates.map((c) => ({ url: c.url, text: c.text }));
    if (isOpenAiEnabled() && candidates.length > LINKS_PER_PAGE) {
      const gaps = describeGaps(computeCoverage(state()));
      const orderedUrls = await prioritizeLinks(
        candidates.map((c) => ({ url: c.url, text: c.text })),
        gaps,
        LINKS_PER_PAGE,
      );
      const byUrl = new Map(candidates.map((c) => [c.url, c]));
      chosen = orderedUrls
        .map((u) => byUrl.get(u))
        .filter((c): c is (typeof candidates)[number] => Boolean(c))
        .map((c) => ({ url: c.url, text: c.text }));
    } else {
      chosen = chosen.slice(0, LINKS_PER_PAGE);
    }

    for (const c of chosen) {
      if (visited.has(c.url) || enqueued.has(c.url)) continue;
      enqueued.add(c.url);
      frontier.push({
        url: c.url,
        text: c.text,
        baseScore: scoreLink(c.url, c.text),
      });
    }

    // Related/future event discovery (budgeted).
    if (eventBudget > 0) {
      try {
        const events = await discoverEvents(html, fromUrl, fromUrl);
        if (events.length > 0) eventBudget -= 1;
        for (const e of events) {
          const existing = discoveredEvents.get(e.eventUrl);
          if (!existing || e.confidence > existing.confidence) {
            discoveredEvents.set(e.eventUrl, e);
          }
        }
      } catch (err) {
        errors.push({
          url: fromUrl,
          stage: "discover",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };

  const crawl = async (url: string): Promise<string | null> => {
    if (visited.has(url)) return null;
    visited.add(url);
    try {
      const fetched = await fetchPage(url);
      const parsed = await adapter.parsePage(fetched.html, fetched.finalUrl);
      parsed.page.contentHash = fetched.contentHash;
      parsed.page.fetchedAt = fetched.fetchedAt;
      pages.push(parsed.page);
      absorb(parsed);
      return fetched.html;
    } catch (err) {
      errors.push({
        url,
        stage: "fetch",
        message: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  };

  // Crawl root, then loop by information gain.
  const rootHtml = await crawl(rootUrl);
  if (rootHtml) await enqueueFromPage(rootHtml, rootUrl);

  while (pages.length < maxPages && frontier.length > 0) {
    const coverage = computeCoverage(state());
    if (isCoverageComplete(coverage)) break;

    const wanted = new Set(desiredPageTypes(coverage));

    // Gap-aware re-scoring: boost candidates whose type fills a current gap.
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < frontier.length; i++) {
      const item = frontier[i];
      const type = classifyPageTypeByUrl(item.url, item.text);
      const gapBoost = wanted.has(type) ? 10 : 0;
      const score = item.baseScore + gapBoost;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;

    const [next] = frontier.splice(bestIdx, 1);
    const html = await crawl(next.url);
    if (html) await enqueueFromPage(html, next.url);
  }

  return finalize(
    runId,
    conference,
    pages,
    sessionsById,
    speakersById,
    discoveredEvents,
    errors,
    options,
  );
}

async function finalize(
  runId: string,
  conference: Conference,
  pages: Page[],
  sessionsById: Map<string, Session>,
  speakersById: Map<string, Speaker>,
  discoveredEvents: Map<string, DiscoveredEvent>,
  errors: IngestionError[],
  options: RunIngestionOptions,
): Promise<IngestionResult> {
  const coverage: Coverage = pages.length
    ? computeCoverage({
        conference,
        sessions: [...sessionsById.values()],
        speakers: [...speakersById.values()],
      })
    : EMPTY_COVERAGE;

  // Freshness: compare page hashes against the most recent prior run.
  if (options.persist !== false) {
    try {
      const previous = await getPreviousRun(conference.websiteUrl);
      if (previous) {
        const prevHash = new Map(
          previous.pages.map((p) => [p.url, p.contentHash]),
        );
        for (const page of pages) {
          if (prevHash.has(page.url)) {
            page.changed = prevHash.get(page.url) !== page.contentHash;
          }
        }
      }
    } catch {
      /* freshness is best-effort */
    }
  }

  const result: IngestionResult = {
    runId,
    conference,
    coverage,
    pages,
    sessions: [...sessionsById.values()],
    speakers: [...speakersById.values()],
    discoveredEvents: [...discoveredEvents.values()],
    errors,
  };

  if (options.persist !== false) {
    try {
      await saveRun(result);
    } catch {
      errors.push({
        url: conference.websiteUrl,
        stage: "parse",
        message: "Failed to persist run to MongoDB",
      });
    }
  }

  return result;
}
