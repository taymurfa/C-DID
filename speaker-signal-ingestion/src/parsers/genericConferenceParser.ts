import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import { deriveTopics } from "../agent/signals.js";
import {
  harvestLinkedInProfiles,
  matchLinkedInForName,
  normalizeLinkedInUrl,
} from "../extract/linkedin.js";
import type { Conference } from "../schemas/conference.js";
import type { Session } from "../schemas/session.js";
import type { Speaker } from "../schemas/speaker.js";

export interface ParsedConferenceContent {
  conference: Partial<Conference>;
  sessions: Session[];
  speakers: Speaker[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function textOrNull($el: Cheerio<AnyNode>): string | null {
  const t = $el.first().text().replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}

function firstText(
  $: cheerio.CheerioAPI,
  scope: Cheerio<AnyNode>,
  selectors: string[],
): string | null {
  for (const selector of selectors) {
    const found = textOrNull(scope.find(selector));
    if (found) return found;
  }
  return null;
}

function dateTimeAttr(
  scope: Cheerio<AnyNode>,
  selectors: string[],
): string | null {
  for (const selector of selectors) {
    const el = scope.find(selector).first();
    const dt = el.attr("datetime");
    if (dt) return dt;
    const text = el.text().trim();
    if (text) {
      const parsed = Date.parse(text);
      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
    }
  }
  return null;
}

function referencedSpeakerIds(
  scope: Cheerio<AnyNode>,
): string[] {
  const ids = new Set<string>();

  const dataAttr = scope.attr("data-speakers");
  if (dataAttr) {
    for (const id of dataAttr.split(/[\s,]+/)) {
      if (id.trim()) ids.add(id.trim());
    }
  }

  scope.find("[data-speaker-id], a.session-speaker, .session-speaker").each((_, el) => {
    const id =
      (el as unknown as { attribs?: Record<string, string> }).attribs?.[
        "data-speaker-id"
      ];
    if (id) {
      ids.add(id);
      return;
    }
    const href = (el as unknown as { attribs?: Record<string, string> }).attribs?.href;
    if (href && href.startsWith("#")) ids.add(href.slice(1));
  });

  return [...ids];
}

/**
 * Deterministic conference parser using conventional class names / semantic
 * markup. This is the fallback path used when OpenAI is not configured, and it
 * is what the fixture tests exercise.
 */
/** Find the first LinkedIn profile link inside a speaker card, if any. */
function linkedInInScope(scope: Cheerio<AnyNode>): string | null {
  let found: string | null = null;
  scope.find("a[href]").each((_, el) => {
    if (found) return;
    const href = (el as unknown as { attribs?: Record<string, string> })
      .attribs?.href;
    const normalized = href ? normalizeLinkedInUrl(href) : null;
    if (normalized) found = normalized;
  });
  return found;
}

export function parseConferenceHtml(
  html: string,
  sourceUrl: string,
): ParsedConferenceContent {
  const $ = cheerio.load(html);

  // Page-wide LinkedIn links, used as a fallback when a card doesn't contain
  // the anchor inside its own scope (e.g. links rendered in a separate block).
  const linkedInProfiles = harvestLinkedInProfiles(html);

  // --- Conference-level fields -------------------------------------------
  const name =
    $("meta[property='og:site_name']").attr("content")?.trim() ||
    $("[data-conference-name]").first().text().replace(/\s+/g, " ").trim() ||
    $("h1").first().text().replace(/\s+/g, " ").trim() ||
    $("title").first().text().replace(/\s+/g, " ").trim() ||
    null;

  const startDate =
    $("[data-conference-start]").attr("datetime") ||
    $("meta[itemprop='startDate']").attr("content") ||
    null;
  const endDate =
    $("[data-conference-end]").attr("datetime") ||
    $("meta[itemprop='endDate']").attr("content") ||
    null;
  const location =
    $("[data-conference-location]").first().text().replace(/\s+/g, " ").trim() ||
    $("meta[itemprop='location']").attr("content")?.trim() ||
    null;

  const conference: Partial<Conference> = {
    name: name || null,
    websiteUrl: sourceUrl,
    startDate: startDate || null,
    endDate: endDate || null,
    location: location || null,
  };

  // --- Speakers -----------------------------------------------------------
  const speakers: Speaker[] = [];
  const speakerIndex = new Map<string, Speaker>();

  $(".speaker, [data-speaker], [itemtype*='Person']").each((_, el) => {
    const scope = $(el);
    const name = firstText($, scope, [
      ".speaker-name",
      "[itemprop='name']",
      "[data-speaker-name]",
      "h2",
      "h3",
    ]);
    if (!name) return;

    const sourceId =
      scope.attr("id") ||
      scope.attr("data-speaker-id") ||
      `speaker:${slugify(name)}`;

    const speaker: Speaker = {
      sourceId,
      name,
      title: firstText($, scope, [
        ".speaker-title",
        "[itemprop='jobTitle']",
        "[data-speaker-title]",
      ]),
      company: firstText($, scope, [
        ".speaker-company",
        "[itemprop='worksFor']",
        "[data-speaker-company]",
      ]),
      bio: firstText($, scope, [
        ".speaker-bio",
        "[itemprop='description']",
        "[data-speaker-bio]",
      ]),
      linkedinUrl:
        linkedInInScope(scope) ?? matchLinkedInForName(name, linkedInProfiles),
      role: "speaker",
      topics: deriveTopics(scope.text()),
      sourceUrl,
      sourceUrls: [sourceUrl],
      sessionSourceIds: [],
      extractionConfidence: 0.5,
    };

    speakers.push(speaker);
    speakerIndex.set(sourceId, speaker);
  });

  // --- Sessions -----------------------------------------------------------
  const sessions: Session[] = [];

  $(".session, [data-session], [itemtype*='Event']").each((_, el) => {
    const scope = $(el);
    const title = firstText($, scope, [
      ".session-title",
      "[itemprop='name']",
      "[data-session-title]",
      "h2",
      "h3",
    ]);
    if (!title) return;

    const sourceId =
      scope.attr("id") ||
      scope.attr("data-session-id") ||
      `session:${slugify(title)}`;

    const speakerSourceIds = referencedSpeakerIds(scope);

    const session: Session = {
      sourceId,
      title,
      description: firstText($, scope, [
        ".session-description",
        "[itemprop='description']",
        "[data-session-description]",
        "p",
      ]),
      startTime: dateTimeAttr(scope, [
        ".session-start",
        "[data-session-start]",
        "time[itemprop='startDate']",
        "time",
      ]),
      endTime: dateTimeAttr(scope, [
        ".session-end",
        "[data-session-end]",
        "time[itemprop='endDate']",
      ]),
      location: firstText($, scope, [
        ".session-location",
        "[itemprop='location']",
        "[data-session-location]",
      ]),
      topics: deriveTopics(scope.text()),
      sourceUrl,
      sourceUrls: [sourceUrl],
      speakerSourceIds,
      extractionConfidence: 0.5,
    };

    sessions.push(session);

    for (const speakerId of speakerSourceIds) {
      const speaker = speakerIndex.get(speakerId);
      if (speaker && !speaker.sessionSourceIds.includes(sourceId)) {
        speaker.sessionSourceIds.push(sourceId);
      }
    }
  });

  return { conference, sessions, speakers };
}
