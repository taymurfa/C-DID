/**
 * Deterministic cleaning/normalization for names, companies, and titles.
 * Everything here is pure and side-effect free so it is trivially testable and
 * safe to run before any AI spend.
 */

const CREDENTIAL_SUFFIXES = new Set([
  "phd",
  "ph.d",
  "ph.d.",
  "mba",
  "pe",
  "p.e",
  "p.e.",
  "cfa",
  "pmp",
  "esq",
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
]);

const HONORIFICS = new Set([
  "mr",
  "mrs",
  "ms",
  "miss",
  "dr",
  "prof",
  "professor",
  "sir",
]);

// Common legal/company suffixes stripped when building a dedupe key (but kept
// for display).
const COMPANY_SUFFIXES = [
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
  "plc",
  "gmbh",
  "ag",
  "sa",
  "s.a",
  "srl",
  "bv",
  "lp",
  "llp",
  "group",
  "holdings",
  "partners",
  "technologies",
  "technology",
  "solutions",
  "systems",
  "labs",
  "the",
];

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part ? part.charAt(0).toUpperCase() + part.slice(1) : part,
        )
        .join("-"),
    )
    .join(" ");
}

/**
 * Clean a person name: strip honorifics/credentials, collapse whitespace, and
 * apply title casing only when the input is all-caps or all-lowercase (to avoid
 * mangling names like "McDonald" or "van der Berg").
 */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  let name = collapseWhitespace(raw.replace(/["'`]/g, ""));
  // Drop a trailing ", PhD" / ", MBA" credential list.
  name = name.replace(/,\s*[^,]+$/g, (match) => {
    const tail = match
      .replace(/^,\s*/, "")
      .toLowerCase()
      .replace(/[.\s]/g, "");
    return CREDENTIAL_SUFFIXES.has(tail) ? "" : match;
  });

  const tokens = name.split(" ").filter(Boolean);
  const cleaned = tokens.filter((token, index) => {
    const bare = token.toLowerCase().replace(/[.]/g, "");
    if (index === 0 && HONORIFICS.has(bare)) return false;
    if (CREDENTIAL_SUFFIXES.has(bare)) return false;
    return true;
  });

  const result = collapseWhitespace(cleaned.join(" "));
  const isAllCaps = result === result.toUpperCase();
  const isAllLower = result === result.toLowerCase();
  return isAllCaps || isAllLower ? toTitleCase(result) : result;
}

/**
 * Clean a job title: collapse whitespace, normalize separators, expand a few
 * common abbreviations, and drop noise.
 */
export function normalizeTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let title = collapseWhitespace(raw.replace(/[\u2013\u2014]/g, "-"));
  title = title.replace(/\s*[|/@]\s*/g, " · ");
  title = title.replace(/\bsvp\b/gi, "SVP");
  title = title.replace(/\bevp\b/gi, "EVP");
  title = title.replace(/\bvp\b/gi, "VP");
  title = title.replace(/\bceo\b/gi, "CEO");
  title = title.replace(/\bcto\b/gi, "CTO");
  title = title.replace(/\bcfo\b/gi, "CFO");
  title = title.replace(/\bcoo\b/gi, "COO");
  title = title.replace(/\bcio\b/gi, "CIO");
  return title.length ? title : null;
}

/**
 * Display-normalized company name: collapse whitespace, strip a trailing legal
 * suffix, and title-case all-caps/all-lower inputs.
 */
export function normalizeCompany(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let company = collapseWhitespace(raw.replace(/[.,]+$/g, ""));
  const isAllCaps = company === company.toUpperCase();
  const isAllLower = company === company.toLowerCase();
  if (isAllCaps || isAllLower) company = toTitleCase(company);
  return company.length ? company : null;
}

/**
 * A canonical key for a company used to group duplicates. Lowercased, punctuation
 * removed, and known legal/generic suffixes stripped (so "HelioCore Energy Inc."
 * and "Heliocore Energy" collapse to the same key).
 */
export function companyKey(raw: string | null | undefined): string {
  if (!raw) return "";
  const tokens = raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !COMPANY_SUFFIXES.includes(token));
  return tokens.join(" ").trim();
}

/** A canonical key for a person used to group duplicates (name + company). */
export function personKey(
  name: string | null | undefined,
  company: string | null | undefined,
): string {
  const n = normalizeName(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const c = companyKey(company);
  return c ? `${n}::${c}` : n;
}
