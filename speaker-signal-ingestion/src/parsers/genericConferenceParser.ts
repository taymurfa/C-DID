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

function mergeUnique(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming].filter(Boolean))];
}

function looksLikePersonName(value: string): boolean {
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 80) return false;
  if (/https?:|www\.|@|\d{4}/i.test(name)) return false;
  if (
    /^(read|view|see|full|bio|speakers?|keynotes?|agenda|schedule|register|learn more)\b/i.test(
      name,
    )
  ) {
    return false;
  }
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return false;
  return parts.every((p) => /^[A-Za-z][A-Za-z.'’-]*$/.test(p));
}

/** `park-madonna` / `lawson-shanks-phill` → display name guess. */
function nameFromSpeakerSlug(slug: string): string | null {
  const parts = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
    .split("-")
    .filter(Boolean);
  if (parts.length < 2) return null;
  // Common Informa pattern: last-first or last-middle-first
  const first = parts[parts.length - 1]!;
  const last = parts.slice(0, -1).join(" ");
  const name = `${first} ${last}`
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return looksLikePersonName(name) ? name : null;
}

function slugFromSpeakerUrl(href: string): string | null {
  try {
    const path = new URL(href).pathname;
    const match = path.match(/\/speakers?\/([^/]+)/i);
    return match?.[1] ? slugify(match[1]) : null;
  } catch {
    return null;
  }
}

function splitTitleCompany(
  roleLine: string | null,
  companyHint: string | null,
): { title: string | null; company: string | null } {
  if (!roleLine && !companyHint) return { title: null, company: null };
  if (companyHint && roleLine && roleLine !== companyHint) {
    return { title: roleLine, company: companyHint };
  }
  const line = (roleLine ?? companyHint ?? "").replace(/\s+/g, " ").trim();
  if (!line) return { title: null, company: null };
  const parts = line.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!;
    // Keep "Ltd.", "Inc.", etc. attached to the company name.
    if (/^(ltd|inc|llc|corp|co)\.?$/i.test(last) && parts.length >= 3) {
      return {
        title: parts.slice(0, -2).join(", ") || null,
        company: `${parts[parts.length - 2]} ${last}`,
      };
    }
    return {
      title: parts.slice(0, -1).join(", ") || null,
      company: last || null,
    };
  }
  return { title: line, company: companyHint };
}

function firstHref(
  scope: Cheerio<AnyNode>,
  selectors: string[],
): string | null {
  for (const selector of selectors) {
    const href = scope.find(selector).first().attr("href")?.trim();
    if (href) return href;
  }
  return null;
}

function absoluteUrl(href: string | undefined, baseUrl: string): string | null {
  if (!href?.trim()) return null;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function textOrNull($el: Cheerio<AnyNode>): string | null {
  // Prefer img alt when the matched element is an image.
  const alt = $el.first().attr("alt")?.replace(/\s+/g, " ").trim();
  if (alt) return alt;
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
  const speakerByName = new Map<string, Speaker>();

  const addSpeaker = (speaker: Speaker) => {
    const nameKey = speaker.name.toLowerCase().replace(/\s+/g, " ").trim();
    const existing =
      speakerIndex.get(speaker.sourceId) ?? speakerByName.get(nameKey);
    if (existing) {
      existing.title = existing.title ?? speaker.title;
      existing.company = existing.company ?? speaker.company;
      existing.bio = existing.bio ?? speaker.bio;
      existing.linkedinUrl = existing.linkedinUrl ?? speaker.linkedinUrl;
      existing.sourceUrls = mergeUnique(existing.sourceUrls, speaker.sourceUrls);
      existing.topics = mergeUnique(existing.topics, speaker.topics);
      existing.extractionConfidence = Math.max(
        existing.extractionConfidence,
        speaker.extractionConfidence,
      );
      if (
        speaker.sourceUrl.includes("/speaker/") &&
        !existing.sourceUrl.includes("/speaker/")
      ) {
        existing.sourceUrl = speaker.sourceUrl;
      }
      speakerIndex.set(speaker.sourceId, existing);
      speakerByName.set(nameKey, existing);
      return;
    }
    speakers.push(speaker);
    speakerIndex.set(speaker.sourceId, speaker);
    speakerByName.set(nameKey, speaker);
  };

  const speakerCardSelector = [
    ".speaker",
    "[data-speaker]",
    "[itemtype*='Person']",
    "[class*='Card__Wrapper']",
    "[class*='SpeakerCard']",
    "[class*='speaker-card']",
  ].join(", ");

  $(speakerCardSelector).each((_, el) => {
    const scope = $(el);
    const name = firstText($, scope, [
      ".speaker-name",
      "[itemprop='name']",
      "[data-speaker-name]",
      "h2",
      "h3",
      "img[alt]",
    ]);
    // Avoid treating generic marketing cards as people.
    if (!name || !looksLikePersonName(name)) return;

    const roleLine =
      firstText($, scope, [
        ".speaker-title",
        "[itemprop='jobTitle']",
        "[data-speaker-title]",
        "p",
      ]) ?? null;
    const { title, company } = splitTitleCompany(
      roleLine,
      firstText($, scope, [
        ".speaker-company",
        "[itemprop='worksFor']",
        "[data-speaker-company]",
      ]),
    );

    const profileHref = firstHref(scope, [
      "a[href*='/speaker/']",
      "a[href*='/speakers/']",
    ]);
    const sourceId =
      scope.attr("id") ||
      scope.attr("data-speaker-id") ||
      (profileHref ? `speaker:${slugFromSpeakerUrl(profileHref)}` : null) ||
      `speaker:${slugify(name)}`;

    addSpeaker({
      sourceId,
      name,
      title,
      company,
      bio: firstText($, scope, [
        ".speaker-bio",
        "[itemprop='description']",
        "[data-speaker-bio]",
      ]),
      linkedinUrl:
        linkedInInScope(scope) ?? matchLinkedInForName(name, linkedInProfiles),
      role: "speaker",
      topics: deriveTopics(scope.text()),
      sourceUrl: profileHref ?? sourceUrl,
      sourceUrls: mergeUnique([sourceUrl], profileHref ? [profileHref] : []),
      sessionSourceIds: [],
      extractionConfidence: profileHref ? 0.7 : 0.55,
    });
  });

  // Fallback: speaker profile links (e.g. schedule.*/speaker/last-first/id)
  // when card markup is missing but bios are linked from the page.
  $("a[href*='/speaker/'], a[href*='/speakers/']").each((_, el) => {
    const href = absoluteUrl($(el).attr("href"), sourceUrl);
    if (!href || !/\/speakers?\//i.test(href)) return;
    const slug = slugFromSpeakerUrl(href);
    if (!slug || slug.length < 3) return;
    const fromSlug = nameFromSpeakerSlug(slug);
    const linkText = $(el).text().replace(/\s+/g, " ").trim();
    const name =
      looksLikePersonName(linkText) && !/^read\b/i.test(linkText)
        ? linkText
        : fromSlug;
    if (!name || !looksLikePersonName(name)) return;
    addSpeaker({
      sourceId: `speaker:${slug}`,
      name,
      title: null,
      company: null,
      bio: null,
      linkedinUrl: matchLinkedInForName(name, linkedInProfiles),
      role: "speaker",
      topics: [],
      sourceUrl: href,
      sourceUrls: [href, sourceUrl],
      sessionSourceIds: [],
      extractionConfidence: 0.45,
    });
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
