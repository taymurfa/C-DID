import type { PageType } from "../schemas/page.js";

/**
 * Deterministic signal vocabulary and scoring. This is Agent 1's cheap first
 * pass: it decides which links look worth following and whether a page's text
 * plausibly contains conference facts BEFORE we spend any OpenAI budget.
 */

export const PRIORITY_KEYWORDS = [
  "agenda",
  "schedule",
  "program",
  "programme",
  "speakers",
  "speaker",
  "presenters",
  "presenter",
  "panelists",
  "panelist",
  "sessions",
  "session",
  "talks",
  "lineup",
  "who-speaks",
];

export const PROFILE_HINTS = ["speaker/", "speakers/", "profile", "/people/"];

// Domain themes (data-center / energy / infrastructure focus). Presence of
// these boosts relevance for both links and event discovery.
export const DOMAIN_THEMES = [
  "data center",
  "datacenter",
  "power",
  "energy",
  "generation",
  "grid",
  "transmission",
  "interconnection",
  "utilities",
  "utility",
  "infrastructure",
  "development",
  "epc",
  "construction",
  "microgrid",
  "behind-the-meter",
  "onsite generation",
  "lng",
  "gas",
  "renewable",
  "renewables",
  "ai",
  "summit",
  "conference",
  "expo",
  "forum",
];

export const EXCLUDE_KEYWORDS = [
  "privacy",
  "terms",
  "cookie",
  "login",
  "signin",
  "sign-in",
  "checkout",
  "cart",
  "ticket",
  "tickets",
  "register",
  "registration",
  "sponsor-kit",
  "media-kit",
  "press-kit",
  "careers",
  "jobs",
  "faq",
  "refund",
  "gdpr",
];

// Softer exclusions: usually low value, but not always. Penalize, don't ban.
export const SOFT_EXCLUDE_KEYWORDS = [
  "sponsor",
  "sponsors",
  "exhibitor",
  "exhibitors",
  "blog",
  "news",
  "press",
  "contact",
  "about",
  "gallery",
  "venue",
  "hotel",
  "travel",
];

export const NON_HTML_EXT =
  /\.(pdf|zip|png|jpe?g|gif|svg|webp|mp4|mp3|css|js|ico|woff2?|ttf|xml|rss)$/i;

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function countMatches(haystack: string, re: RegExp): number {
  return (haystack.match(re) ?? []).length;
}

/**
 * Score a candidate link from its URL + anchor text. Returns a number where
 * higher is more worth crawling. Hard-excluded junk returns -1.
 */
export function scoreLink(url: string, text: string): number {
  const haystack = `${url} ${text}`.toLowerCase();
  if (includesAny(haystack, EXCLUDE_KEYWORDS)) return -1;

  let score = 0;
  for (const keyword of PRIORITY_KEYWORDS) {
    if (haystack.includes(keyword)) score += 6;
  }
  for (const theme of DOMAIN_THEMES) {
    if (haystack.includes(theme)) score += 1;
  }
  for (const soft of SOFT_EXCLUDE_KEYWORDS) {
    if (haystack.includes(soft)) score -= 3;
  }

  try {
    const depth = new URL(url).pathname.split("/").filter(Boolean).length;
    score += Math.max(0, 3 - depth);
  } catch {
    /* ignore */
  }
  return score;
}

export function classifyPageTypeByUrl(url: string, text = ""): PageType {
  const haystack = `${url} ${text}`.toLowerCase();
  if (/(agenda|schedule|program)/.test(haystack)) return "agenda";
  if (/(speakers|presenters|panelists)\b/.test(haystack)) return "speakers";
  if (includesAny(haystack, PROFILE_HINTS) && /speaker/.test(haystack))
    return "profile";
  if (/sessions?|talks?/.test(haystack)) return "session";
  if (/\/events?(\/|$)|all-events|past-events|editions/.test(haystack))
    return "series";
  return "unknown";
}

export interface ContentSignals {
  hasPeopleNames: boolean;
  hasJobTitles: boolean;
  hasCompanies: boolean;
  hasSessionTitles: boolean;
  hasTimes: boolean;
  hasDates: boolean;
  hasDescriptions: boolean;
  /** Aggregate 0..1 confidence that this page holds conference facts. */
  score: number;
}

const JOB_TITLE_RE =
  /\b(ceo|cto|cfo|coo|cio|vp|vice president|director|head of|founder|co-founder|president|chief|manager|lead|principal|engineer|architect|scientist|officer|partner|analyst|consultant)\b/i;
const COMPANY_RE =
  /\b(inc|llc|ltd|corp|corporation|company|co\.|technologies|systems|group|labs|solutions|energy|power|capital|partners|ventures|university|institute)\b/i;
const TIME_RE = /\b([01]?\d|2[0-3])[:.][0-5]\d\s*(am|pm)?\b|\b\d{1,2}\s*(am|pm)\b/i;
const DATE_RE =
  /\b(20\d{2})\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
// "Firstname Lastname" style capitalized name pairs.
const NAME_RE = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/;

/**
 * Cheaply estimate whether a page's cleaned text contains conference facts,
 * so the loop can skip OpenAI extraction on pages that clearly won't help.
 */
export function analyzeContentSignals(text: string): ContentSignals {
  const nameMatches = countMatches(text, new RegExp(NAME_RE, "g"));
  const hasPeopleNames = nameMatches >= 2;
  const hasJobTitles = JOB_TITLE_RE.test(text);
  const hasCompanies = COMPANY_RE.test(text);
  const hasTimes = TIME_RE.test(text);
  const hasDates = DATE_RE.test(text);
  // Session titles: heuristic - colon-separated headlines or many capitalized
  // lines. Approximate with presence of times/agenda words + names.
  const hasSessionTitles =
    /\b(keynote|panel|workshop|session|talk|fireside|roundtable)\b/i.test(text);
  const hasDescriptions = text.length > 400;

  const flags = [
    hasPeopleNames,
    hasJobTitles,
    hasCompanies,
    hasSessionTitles,
    hasTimes,
    hasDates,
    hasDescriptions,
  ];
  const score = flags.filter(Boolean).length / flags.length;

  return {
    hasPeopleNames,
    hasJobTitles,
    hasCompanies,
    hasSessionTitles,
    hasTimes,
    hasDates,
    hasDescriptions,
    score,
  };
}

/** Detect a 4-digit edition year from a URL or anchor text, if present. */
export function detectYear(text: string): number | null {
  const m = text.match(/\b(20\d{2})\b/);
  return m ? Number.parseInt(m[1], 10) : null;
}

// Canonical topic tags derived from domain themes. Maps several surface forms
// to one tag so downstream tagging is consistent.
const TOPIC_MAP: Record<string, string> = {
  "data center": "data centers",
  datacenter: "data centers",
  power: "power",
  energy: "energy",
  generation: "generation",
  grid: "grid",
  transmission: "transmission",
  interconnection: "interconnection",
  utilities: "utilities",
  utility: "utilities",
  infrastructure: "infrastructure",
  epc: "epc",
  construction: "construction",
  microgrid: "microgrids",
  "behind-the-meter": "behind-the-meter",
  "onsite generation": "onsite generation",
  lng: "gas/lng",
  gas: "gas/lng",
  renewable: "renewables",
  renewables: "renewables",
  ai: "ai",
};

/**
 * Deterministically derive canonical topic tags from text by matching known
 * domain themes. Used as a fallback when OpenAI is unavailable and to enrich
 * OpenAI output. Only returns topics actually present in the text.
 */
export function deriveTopics(text: string): string[] {
  const haystack = ` ${text.toLowerCase()} `;
  const found = new Set<string>();
  for (const [surface, tag] of Object.entries(TOPIC_MAP)) {
    const boundary = /^[a-z]/.test(surface) && !surface.includes(" ");
    const hit = boundary
      ? new RegExp(`\\b${surface}\\b`).test(haystack)
      : haystack.includes(surface);
    if (hit) found.add(tag);
  }
  return [...found];
}

/** Does this text/url look like it references a conference edition/event? */
export function looksLikeEventLink(url: string, text: string): boolean {
  const haystack = `${url} ${text}`.toLowerCase();
  const hasEventWord = /(summit|conference|expo|forum|event|edition)/.test(
    haystack,
  );
  const hasYear = detectYear(haystack) !== null;
  const hasTheme = includesAny(haystack, DOMAIN_THEMES);
  return (hasEventWord && (hasYear || hasTheme)) || /\/events?\//.test(haystack);
}
