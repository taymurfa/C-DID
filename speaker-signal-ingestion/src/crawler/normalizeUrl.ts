const TRACKING_PARAM_PREFIXES = ["utm_", "mc_", "ref_"];
const TRACKING_PARAMS = new Set([
  "ref",
  "fbclid",
  "gclid",
  "igshid",
  "yclid",
  "msclkid",
]);

/**
 * Canonicalize a URL for crawling:
 * - resolve relative URLs against a base
 * - force http/https only (returns null otherwise)
 * - drop the fragment
 * - strip common tracking query params
 * - lowercase the host
 * - remove trailing slash (except root)
 */
export function normalizeUrl(input: string, base?: string): string | null {
  let url: URL;
  try {
    url = base ? new URL(input, base) : new URL(input);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (
      TRACKING_PARAMS.has(lower) ||
      TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p))
    ) {
      url.searchParams.delete(key);
    }
  }

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

/**
 * Registrable-domain-ish comparison. We collapse to the last two labels
 * (e.g. `www.events.example.com` -> `example.com`) which is good enough to
 * keep the crawl bounded to a single conference site without pulling in a
 * public-suffix dependency.
 */
export function baseDomain(hostname: string): string {
  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  return labels.slice(-2).join(".");
}

export function sameSite(a: string, b: string): boolean {
  try {
    return baseDomain(new URL(a).hostname) === baseDomain(new URL(b).hostname);
  } catch {
    return false;
  }
}
