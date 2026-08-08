import { env } from "../config/env.js";

interface RobotsRules {
  disallow: string[];
  allow: string[];
}

const cache = new Map<string, RobotsRules>();

/**
 * Minimal robots.txt parser. It collects rules from `User-agent: *` groups
 * (plus any group naming our own agent) and evaluates the longest-match
 * allow/disallow directive, which mirrors the common robots.txt precedence.
 */
function parseRobots(txt: string): RobotsRules {
  const rules: RobotsRules = { disallow: [], allow: [] };
  let applies = false;

  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const sepIndex = line.indexOf(":");
    if (sepIndex === -1) continue;

    const field = line.slice(0, sepIndex).trim().toLowerCase();
    const value = line.slice(sepIndex + 1).trim();

    if (field === "user-agent") {
      const ua = value.toLowerCase();
      applies = ua === "*" || env.crawl.userAgent.toLowerCase().includes(ua);
      continue;
    }

    if (!applies) continue;
    if (field === "disallow" && value) rules.disallow.push(value);
    if (field === "allow" && value) rules.allow.push(value);
  }

  return rules;
}

async function loadRules(origin: string): Promise<RobotsRules> {
  const cached = cache.get(origin);
  if (cached) return cached;

  let rules: RobotsRules = { disallow: [], allow: [] };
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "user-agent": env.crawl.userAgent },
      signal: AbortSignal.timeout(env.crawl.requestTimeoutMs),
    });
    if (res.ok) {
      rules = parseRobots(await res.text());
    }
  } catch {
    // If robots.txt cannot be fetched, default to permissive (empty rules).
  }

  cache.set(origin, rules);
  return rules;
}

function matches(path: string, rule: string): boolean {
  // Support the `*` wildcard and `$` end-anchor used in robots.txt.
  const escaped = rule
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\\\$$/, "$");
  return new RegExp(`^${escaped}`).test(path);
}

export async function isAllowed(targetUrl: string): Promise<boolean> {
  if (!env.respectRobots) return true;

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return false;
  }

  const rules = await loadRules(parsed.origin);
  const path = parsed.pathname + parsed.search;

  const longestAllow = rules.allow
    .filter((r) => matches(path, r))
    .reduce((max, r) => Math.max(max, r.length), -1);
  const longestDisallow = rules.disallow
    .filter((r) => matches(path, r))
    .reduce((max, r) => Math.max(max, r.length), -1);

  if (longestDisallow === -1) return true;
  return longestAllow >= longestDisallow;
}

/** For tests only. */
export function __clearRobotsCache(): void {
  cache.clear();
}
