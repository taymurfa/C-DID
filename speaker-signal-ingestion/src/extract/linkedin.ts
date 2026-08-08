import * as cheerio from "cheerio";

/**
 * LinkedIn profile capture (policy-compliant).
 *
 * This service does NOT fetch or scrape LinkedIn pages directly: LinkedIn
 * requires authentication and actively blocks automated access, which is out
 * of scope per the service's "public data only, no auth/anti-bot bypass"
 * policy. Instead, we capture the LinkedIn profile URLs that speakers already
 * publish on the public conference site (speaker cards very commonly link to
 * them) and attach them to the speaker as evidence-backed contact signal.
 */

// Matches a personal LinkedIn profile path: /in/<slug> (modern) or /pub/<slug>
// (legacy). Deliberately ignores /company/, /school/, /showcase/, feed posts.
const PROFILE_PATH_RE = /^\/(in|pub)\/[^/?#]+/i;

/** Is this href a LinkedIn personal profile URL? */
export function isLinkedInProfileUrl(href: string): boolean {
  return normalizeLinkedInUrl(href) !== null;
}

/**
 * Canonicalize a LinkedIn profile URL to `https://www.linkedin.com/in/<slug>`.
 * Returns null when the URL is not a personal profile link.
 */
export function normalizeLinkedInUrl(href: string): string | null {
  if (!href) return null;
  let raw = href.trim();
  // Tolerate protocol-relative and bare-domain hrefs.
  if (raw.startsWith("//")) raw = `https:${raw}`;
  else if (/^(www\.)?linkedin\.com/i.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const isLinkedIn = host === "linkedin.com" || host.endsWith(".linkedin.com");
  if (!isLinkedIn) return null;
  if (!PROFILE_PATH_RE.test(url.pathname)) return null;

  // Keep only the /in/<slug> (or /pub/<slug>) segment; drop tracking params,
  // trailing slashes, locale subdomains, and fragments.
  const segments = url.pathname.split("/").filter(Boolean);
  const kind = segments[0].toLowerCase(); // "in" | "pub"
  const slug = segments[1];
  if (!slug) return null;

  return `https://www.linkedin.com/${kind}/${slug}`;
}

export interface LinkedInProfileRef {
  url: string;
  /** Lowercased nearby text used to associate the link with a person. */
  context: string;
}

/**
 * Scan raw HTML for every LinkedIn profile link and capture surrounding text
 * so callers can associate each link with the right speaker by name.
 */
export function harvestLinkedInProfiles(html: string): LinkedInProfileRef[] {
  const $ = cheerio.load(html);
  const seen = new Map<string, LinkedInProfileRef>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const url = normalizeLinkedInUrl(href);
    if (!url) return;

    const anchorText = $(el).text().replace(/\s+/g, " ").trim();
    // Walk up to a reasonable container (speaker card) for name context.
    const container = $(el).closest(
      ".speaker, [data-speaker], [itemtype*='Person'], li, article, .card, .team-member, .profile",
    );
    const containerText = (container.length ? container : $(el).parent())
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);

    const context = `${anchorText} ${containerText}`.toLowerCase();
    const existing = seen.get(url);
    if (existing) {
      existing.context = `${existing.context} ${context}`.slice(0, 600);
    } else {
      seen.set(url, { url, context });
    }
  });

  return [...seen.values()];
}

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 3);
}

/**
 * Pick the LinkedIn profile that best matches a speaker name from a harvested
 * list. A match requires either the full name to appear in the link context,
 * or the profile slug to contain the speaker's name tokens (e.g. "jane-doe").
 */
export function matchLinkedInForName(
  name: string,
  profiles: LinkedInProfileRef[],
): string | null {
  if (!name || profiles.length === 0) return null;
  const tokens = nameTokens(name);
  if (tokens.length === 0) return null;

  for (const profile of profiles) {
    const slug = profile.url.split("/").pop()?.toLowerCase() ?? "";
    const contextHit = tokens.every((t) => profile.context.includes(t));
    // Slug hit: at least two name tokens present in the slug (first + last),
    // or a single distinctive token for mononyms.
    const slugMatches = tokens.filter((t) => slug.includes(t)).length;
    const slugHit =
      tokens.length >= 2 ? slugMatches >= 2 : slugMatches >= 1;
    if (contextHit || slugHit) return profile.url;
  }

  return null;
}
