import { createHash } from "node:crypto";
import pLimit from "p-limit";
import { env } from "../config/env.js";
import { normalizeUrl } from "./normalizeUrl.js";
import { isAllowed } from "./robots.js";

export interface FetchedPage {
  url: string;
  finalUrl: string;
  html: string;
  contentHash: string;
  fetchedAt: string;
  renderedWith: "cheerio" | "playwright";
}

const limit = pLimit(env.crawl.concurrency);
const lastRequestByHost = new Map<string, number>();

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Enforce a minimum delay between requests to the same host. */
async function politeDelay(url: string): Promise<void> {
  const host = hostOf(url);
  const now = Date.now();
  const last = lastRequestByHost.get(host) ?? 0;
  const wait = last + env.crawl.requestDelayMs - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestByHost.set(host, Date.now());
}

function hashContent(html: string): string {
  return createHash("sha256").update(html).digest("hex");
}

/**
 * Heuristic: does the static HTML already contain useful content, or is it a
 * mostly-empty JS shell that needs a real browser to render?
 */
function needsRendering(html: string): boolean {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const bodyMatch = withoutScripts.match(/<body[\s\S]*?<\/body>/i);
  const body = bodyMatch ? bodyMatch[0] : withoutScripts;
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length < 200;
}

/**
 * Detect an HTML `<meta http-equiv="refresh">` redirect (common for static-site
 * landing stubs) and return the normalized target URL, if any. HTTP-level
 * redirects are already followed by fetch; this covers the client-side kind.
 */
function extractMetaRefresh(html: string, baseUrl: string): string | null {
  const match = html.match(
    /<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?\s*\d+\s*;\s*url=([^"'>\s]+)/i,
  );
  if (!match) return null;
  return normalizeUrl(match[1].trim(), baseUrl);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    statusText: string,
    readonly retryAfterMs: number | null = null,
  ) {
    super(`HTTP ${status} ${statusText}`);
    this.name = "HttpError";
  }
}

function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number.parseInt(headerValue, 10);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const dateMs = Date.parse(headerValue);
  return Number.isNaN(dateMs) ? null : Math.max(0, dateMs - Date.now());
}

async function fetchStaticOnce(
  url: string,
): Promise<{ finalUrl: string; html: string }> {
  const res = await fetch(url, {
    headers: {
      "user-agent": env.crawl.userAgent,
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(env.crawl.requestTimeoutMs),
  });
  if (!res.ok) {
    throw new HttpError(
      res.status,
      res.statusText,
      parseRetryAfter(res.headers.get("retry-after")),
    );
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("html")) {
    // Not retryable - the resource simply isn't HTML.
    const err = new Error(`Unsupported content-type: ${contentType}`);
    err.name = "NonRetryableError";
    throw err;
  }
  return { finalUrl: res.url || url, html: await res.text() };
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) {
    return err.status === 429 || err.status >= 500;
  }
  if (err instanceof Error) {
    if (err.name === "NonRetryableError") return false;
    // Network failures and AbortSignal.timeout() -> TimeoutError/AbortError.
    return true;
  }
  return false;
}

/**
 * Fetch static HTML with bounded exponential backoff. Retries transient
 * failures (network errors, timeouts, HTTP 429 and 5xx), honoring a
 * Retry-After header when present. Non-transient failures (4xx, non-HTML) throw
 * immediately.
 */
export async function fetchStatic(
  url: string,
): Promise<{ finalUrl: string; html: string }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= env.crawl.maxRetries; attempt++) {
    try {
      return await fetchStaticOnce(url);
    } catch (err) {
      lastErr = err;
      if (attempt >= env.crawl.maxRetries || !isRetryable(err)) break;
      const backoff = env.crawl.retryBaseMs * 2 ** attempt;
      const jitter = Math.floor(Math.random() * env.crawl.retryBaseMs);
      const retryAfter =
        err instanceof HttpError ? err.retryAfterMs ?? 0 : 0;
      await new Promise((r) => setTimeout(r, Math.max(backoff + jitter, retryAfter)));
    }
  }
  throw lastErr;
}

async function fetchRendered(url: string): Promise<{ finalUrl: string; html: string }> {
  // Import lazily so the service (and tests) run without Chromium installed
  // unless a page actually needs rendering.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: env.crawl.userAgent,
    });
    const page = await context.newPage();
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: env.crawl.requestTimeoutMs,
    });
    const html = await page.content();
    return { finalUrl: page.url(), html };
  } finally {
    await browser.close();
  }
}

/**
 * Fetch a single public page. Uses a plain HTTP fetch (for Cheerio) by default
 * and only falls back to Playwright when the static HTML looks like an empty
 * JS shell. Respects robots.txt and per-host rate limits. Never attempts to
 * bypass authentication, paywalls, CAPTCHAs, or anti-bot protections.
 */
export function fetchPage(url: string): Promise<FetchedPage> {
  return limit(async () => {
    const allowed = await isAllowed(url);
    if (!allowed) {
      throw new Error(`Blocked by robots.txt: ${url}`);
    }

    await politeDelay(url);

    let renderedWith: FetchedPage["renderedWith"] = "cheerio";
    let { finalUrl, html } = await fetchStatic(url);

    // Follow client-side <meta refresh> redirects (bounded to avoid loops).
    let refreshTarget = extractMetaRefresh(html, finalUrl);
    for (let hops = 0; refreshTarget && hops < 3; hops++) {
      if (refreshTarget === finalUrl) break;
      if (!(await isAllowed(refreshTarget))) break;
      await politeDelay(refreshTarget);
      const next = await fetchStatic(refreshTarget);
      finalUrl = next.finalUrl;
      html = next.html;
      refreshTarget = extractMetaRefresh(html, finalUrl);
    }

    if (needsRendering(html)) {
      try {
        const rendered = await fetchRendered(url);
        finalUrl = rendered.finalUrl;
        html = rendered.html;
        renderedWith = "playwright";
      } catch {
        // Keep the static HTML if the browser fallback is unavailable/fails.
      }
    }

    return {
      url,
      finalUrl,
      html,
      contentHash: hashContent(html),
      fetchedAt: new Date().toISOString(),
      renderedWith,
    };
  });
}
