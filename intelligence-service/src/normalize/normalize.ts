/**
 * Cleaning and normalization of the noisy strings Agent 1 scrapes. Everything
 * here is deterministic and side-effect free so it is trivially testable and
 * runs with no external dependencies.
 */

const WHITESPACE_RE = /\s+/g;

// Honorifics / credential noise we strip from scraped names.
const NAME_PREFIXES = new Set([
  "mr",
  "mrs",
  "ms",
  "miss",
  "dr",
  "prof",
  "professor",
  "sir",
  "rev",
]);
const NAME_SUFFIXES = new Set([
  "phd",
  "ph.d",
  "md",
  "mba",
  "msc",
  "bsc",
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
  "esq",
  "cfa",
  "pe",
  "pmp",
]);

// Common legal / structural suffixes stripped when building a company key.
const COMPANY_SUFFIXES = new Set([
  "inc",
  "inc.",
  "incorporated",
  "llc",
  "l.l.c",
  "ltd",
  "ltd.",
  "limited",
  "corp",
  "corp.",
  "corporation",
  "co",
  "co.",
  "company",
  "gmbh",
  "ag",
  "sa",
  "s.a",
  "plc",
  "pte",
  "bv",
  "srl",
  "llp",
  "lp",
  "group",
  "holdings",
  "holding",
  "technologies",
  "technology",
  "solutions",
  "systems",
  "labs",
  "laboratories",
  "international",
  "worldwide",
  "global",
]);

function collapse(value: string): string {
  return value.replace(WHITESPACE_RE, " ").trim();
}

function stripToken(token: string): string {
  return token.replace(/[.,]+$/g, "").toLowerCase();
}

function titleCaseWord(word: string): string {
  if (!word) return word;
  // Preserve intentional internal capitals (McKay, DeVry) but fix ALLCAPS /
  // lowercase scraped names (DOE -> Doe, jane -> Jane).
  if (/[a-z]/.test(word) && /[A-Z]/.test(word.slice(1))) return word;
  const parts = word.split(/([-'])/);
  return parts
    .map((p) =>
      /[-']/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(),
    )
    .join("");
}

/**
 * Normalize a scraped person name: collapse whitespace, drop honorifics and
 * trailing credentials, and title-case the remainder. Returns "" for junk.
 */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  let value = collapse(raw);
  if (!value) return "";
  // Drop anything after a comma (usually a title/credential list).
  value = value.split(",")[0] ?? value;
  const tokens = collapse(value).split(" ").filter(Boolean);

  while (tokens.length > 1 && NAME_PREFIXES.has(stripToken(tokens[0]))) {
    tokens.shift();
  }
  while (
    tokens.length > 1 &&
    NAME_SUFFIXES.has(stripToken(tokens[tokens.length - 1]))
  ) {
    tokens.pop();
  }
  return tokens.map(titleCaseWord).join(" ");
}

/**
 * Normalize a job title: collapse whitespace, standardize separators, and
 * expand a few high-signal abbreviations so scoring and display are stable.
 */
export function normalizeTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = collapse(raw);
  if (!value) return null;
  value = value
    .replace(/\s*[|/]\s*/g, " / ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\bsr\b\.?/gi, "Senior")
    .replace(/\bjr\b\.?/gi, "Junior")
    .replace(/\bvp\b/gi, "VP")
    .replace(/\bsvp\b/gi, "SVP")
    .replace(/\bevp\b/gi, "EVP");
  return collapse(value);
}

/**
 * Normalize a company's display name: collapse whitespace and trim trailing
 * punctuation, but keep the human-readable form (suffixes intact).
 */
export function normalizeCompanyDisplay(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const value = collapse(raw).replace(/[.,;:]+$/g, "");
  return value || null;
}

/**
 * Build a canonical dedup key for a company: lowercase, strip punctuation, drop
 * common legal/structural suffixes and the word "the". Two surface forms that
 * refer to the same company (e.g. "Cloudscale, Inc." and "Cloudscale") collapse
 * to the same key.
 */
export function companyKey(raw: string | null | undefined): string | null {
  const display = normalizeCompanyDisplay(raw);
  if (!display) return null;
  const tokens = display
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(WHITESPACE_RE)
    .filter(Boolean)
    .filter((t) => t !== "the");

  while (tokens.length > 1 && COMPANY_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  const key = tokens.join(" ").trim();
  return key || null;
}

/**
 * A stable identity key for a person, used to detect the same speaker appearing
 * on multiple pages. Combines normalized name with company key when available
 * so two different "John Smith"s at different companies stay distinct.
 */
export function personKey(
  name: string | null | undefined,
  company: string | null | undefined,
): string {
  const n = normalizeName(name).toLowerCase();
  const c = companyKey(company);
  return c ? `${n}|${c}` : n;
}
