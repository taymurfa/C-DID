import { z } from "zod";
import { deriveTopics } from "../agent/signals.js";
import type { ParsedConferenceContent } from "../parsers/genericConferenceParser.js";
import { cleanHtml, limitText } from "../parsers/htmlCleaner.js";
import {
  harvestLinkedInProfiles,
  matchLinkedInForName,
  normalizeLinkedInUrl,
} from "./linkedin.js";
import { chatJson, isOpenAiEnabled } from "./openaiClient.js";

export { isOpenAiEnabled };

// Lenient schema for the raw model output; coerced into strict domain types.
const LlmSpeaker = z.object({
  sourceId: z.string().optional(),
  name: z.string(),
  title: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  role: z
    .enum([
      "speaker",
      "moderator",
      "sponsor",
      "staff",
      "exhibitor",
      "journalist",
      "unknown",
    ])
    .optional(),
  topics: z.array(z.string()).optional(),
  sessionSourceIds: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const LlmSession = z.object({
  sourceId: z.string().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  topics: z.array(z.string()).optional(),
  speakerSourceIds: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const LlmResult = z.object({
  conference: z
    .object({
      name: z.string().nullable().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      location: z.string().nullable().optional(),
    })
    .optional(),
  sessions: z.array(LlmSession).optional(),
  speakers: z.array(LlmSpeaker).optional(),
});

function mergeTopics(modelTopics: string[] | undefined, text: string): string[] {
  const normalized = (modelTopics ?? []).map((t) => t.trim().toLowerCase());
  return [...new Set([...normalized, ...deriveTopics(text)])].filter(Boolean);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const SYSTEM_PROMPT = `You are Agent 1, a precise conference information extractor.
You receive the cleaned text (and any JSON-LD) of ONE public conference page.
Rules:
- Extract only facts explicitly present. NEVER invent missing values; use null.
- Identify real people and label each with a role: speaker, moderator, sponsor,
  staff, exhibitor, journalist, or unknown. Include everyone reasonable, but
  role them correctly (do not call a sponsor logo a speaker).
- Map each person to their company and to the sessions they present, when the
  page states it.
- If a person's public LinkedIn profile URL is present on the page, include it
  as linkedinUrl; otherwise use null. Never guess or fabricate a profile URL.
- Add 1-5 concise lowercase topic tags per session and per speaker, derived only
  from the stated title/description/bio (e.g. "data centers", "grid", "ai").
- For dates/times prefer ISO 8601.
- Assign consistent sourceId values you invent (e.g. "speaker:jane-doe",
  "session:opening-keynote") and reuse them to link speakers<->sessions.
- Provide a per-item confidence (0-1) reflecting how clearly the page states it.
Return strict JSON.`;

/**
 * Use OpenAI to structure a conference page. Returns null on any failure so the
 * caller can fall back to deterministic parsing. Never throws.
 */
export async function extractWithOpenAi(
  html: string,
  sourceUrl: string,
): Promise<ParsedConferenceContent | null> {
  if (!isOpenAiEnabled()) return null;

  const cleaned = cleanHtml(html);
  const payload = {
    url: sourceUrl,
    title: cleaned.title,
    jsonLd: cleaned.jsonLd,
    text: limitText(cleaned.text),
  };

  const raw = await chatJson(
    SYSTEM_PROMPT,
    "Extract conference info as JSON with keys: conference, sessions, speakers.\n" +
      "sessions[]: sourceId,title,description,startTime,endTime,location,topics,speakerSourceIds,confidence.\n" +
      "speakers[]: sourceId,name,title,company,bio,linkedinUrl,role,topics,sessionSourceIds,confidence.\n" +
      "conference: name,startDate,endDate,location.\n\n" +
      `PAGE:\n${JSON.stringify(payload)}`,
    3000,
  );
  if (raw === null) return null;

  const parsed = LlmResult.safeParse(raw);
  if (!parsed.success) return null;

  return coerce(parsed.data, sourceUrl, html);
}

function coerce(
  data: z.infer<typeof LlmResult>,
  sourceUrl: string,
  html: string,
): ParsedConferenceContent {
  // Deterministically harvest LinkedIn profile links from the raw HTML: the
  // cleaned text sent to the model drops hrefs, so we trust the DOM over the
  // model for the actual URL and match links to speakers by name.
  const linkedInProfiles = harvestLinkedInProfiles(html);

  const speakers = (data.speakers ?? []).map((s) => ({
    sourceId: s.sourceId || `speaker:${slugify(s.name)}`,
    name: s.name,
    title: s.title ?? null,
    company: s.company ?? null,
    bio: s.bio ?? null,
    linkedinUrl:
      matchLinkedInForName(s.name, linkedInProfiles) ??
      (s.linkedinUrl ? normalizeLinkedInUrl(s.linkedinUrl) : null),
    role: s.role ?? "speaker",
    topics: mergeTopics(s.topics, `${s.title ?? ""} ${s.bio ?? ""}`),
    sourceUrl,
    sourceUrls: [sourceUrl],
    sessionSourceIds: s.sessionSourceIds ?? [],
    extractionConfidence: s.confidence ?? 0.8,
  }));

  const sessions = (data.sessions ?? []).map((s) => ({
    sourceId: s.sourceId || `session:${slugify(s.title)}`,
    title: s.title,
    description: s.description ?? null,
    startTime: s.startTime ?? null,
    endTime: s.endTime ?? null,
    location: s.location ?? null,
    topics: mergeTopics(s.topics, `${s.title} ${s.description ?? ""}`),
    sourceUrl,
    sourceUrls: [sourceUrl],
    speakerSourceIds: s.speakerSourceIds ?? [],
    extractionConfidence: s.confidence ?? 0.8,
  }));

  // Backfill speaker.sessionSourceIds from session links (bidirectional).
  const speakerById = new Map(speakers.map((s) => [s.sourceId, s]));
  for (const session of sessions) {
    for (const speakerId of session.speakerSourceIds) {
      const speaker = speakerById.get(speakerId);
      if (speaker && !speaker.sessionSourceIds.includes(session.sourceId)) {
        speaker.sessionSourceIds.push(session.sourceId);
      }
    }
  }

  return {
    conference: {
      name: data.conference?.name ?? null,
      websiteUrl: sourceUrl,
      startDate: data.conference?.startDate ?? null,
      endDate: data.conference?.endDate ?? null,
      location: data.conference?.location ?? null,
    },
    sessions,
    speakers,
  };
}
