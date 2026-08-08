import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import { analyzeContentSignals } from "../agent/signals.js";
import { classifyPage } from "../agent/reason.js";
import { discoverPages } from "../crawler/discoverPages.js";
import { extractWithOpenAi, isOpenAiEnabled } from "../extract/openaiExtractor.js";
import { parseConferenceHtml } from "../parsers/genericConferenceParser.js";
import { cleanHtml } from "../parsers/htmlCleaner.js";
import type { ParsedPage } from "../schemas/ingestion.js";
import type { ConferenceAdapter } from "./ConferenceAdapter.js";

/**
 * Default adapter used for any conference site. Discovery uses the shared
 * signal-based crawler; parsing classifies the page, applies a cheap
 * deterministic content gate, then prefers OpenAI extraction (falling back to
 * deterministic parsing when OpenAI is unavailable or unhelpful).
 */
export class GenericConferenceAdapter implements ConferenceAdapter {
  matches(_url: string): boolean {
    return true;
  }

  async discoverPages(html: string, baseUrl: string): Promise<string[]> {
    return discoverPages(html, baseUrl, env.crawl.maxPages).map((l) => l.url);
  }

  async parsePage(html: string, url: string): Promise<ParsedPage> {
    const cleaned = cleanHtml(html);
    const signals = analyzeContentSignals(cleaned.text);
    const pageType = await classifyPage(url, cleaned.title, cleaned.text);

    // Cost gate: only spend OpenAI on pages that plausibly hold conference
    // facts (by content signals) or by classified type.
    const worthExtracting =
      signals.score >= 0.28 ||
      ["agenda", "speakers", "session", "profile", "overview"].includes(
        pageType,
      );

    let content = null;
    if (isOpenAiEnabled() && worthExtracting) {
      content = await extractWithOpenAi(html, url);
    }
    if (!content) {
      content = parseConferenceHtml(html, url);
    }

    return {
      page: {
        url,
        pageType,
        contentHash: createHash("sha256").update(html).digest("hex"),
        fetchedAt: new Date().toISOString(),
        changed: null,
      },
      conference: content.conference,
      sessions: content.sessions,
      speakers: content.speakers,
    };
  }
}

export const genericConferenceAdapter = new GenericConferenceAdapter();
