import * as cheerio from "cheerio";

export interface CleanedContent {
  title: string | null;
  text: string;
  /** JSON-LD blocks (schema.org Event/Person etc.) found on the page. */
  jsonLd: unknown[];
}

const STRIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "nav",
  "header",
  "footer",
  "form",
  "iframe",
  "[aria-hidden='true']",
];

/**
 * Reduce a raw HTML page to clean text plus any structured JSON-LD, suitable
 * for feeding to the LLM extractor (and cheaper on tokens).
 */
export function cleanHtml(html: string): CleanedContent {
  const $ = cheerio.load(html);

  const jsonLd: unknown[] = [];
  $("script[type='application/ld+json']").each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      jsonLd.push(JSON.parse(raw));
    } catch {
      /* ignore malformed JSON-LD */
    }
  });

  const title =
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    null;

  for (const selector of STRIP_SELECTORS) {
    $(selector).remove();
  }

  const text = $("body").text().replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();

  return { title, text, jsonLd };
}

/** Truncate cleaned text so we stay within a reasonable token budget. */
export function limitText(text: string, maxChars = 12000): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n...[truncated]` : text;
}
