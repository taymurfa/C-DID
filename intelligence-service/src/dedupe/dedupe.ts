import type { InputSpeaker, PersonRole } from "../schemas/ingestionInput.js";
import {
  companyKey,
  normalizeCompanyDisplay,
  normalizeName,
  normalizeTitle,
  personKey,
} from "../normalize/normalize.js";

/**
 * A single logical person after cleaning + merging duplicate scraped records.
 * All string fields are normalized; array fields are unioned across sources.
 */
export interface DedupedSpeaker {
  key: string;
  name: string;
  originalName: string;
  title: string | null;
  company: string | null;
  companyKey: string | null;
  bio: string | null;
  role: PersonRole;
  topics: string[];
  sessionSourceIds: string[];
  sourceUrls: string[];
  mergedSourceIds: string[];
  extractionConfidence: number;
}

// Prefer the most informative role when merging (a "speaker" record beats an
// "unknown" one for the same person).
const ROLE_PRIORITY: Record<PersonRole, number> = {
  speaker: 6,
  moderator: 5,
  journalist: 4,
  exhibitor: 3,
  sponsor: 2,
  staff: 1,
  unknown: 0,
};

function betterRole(a: PersonRole, b: PersonRole): PersonRole {
  return ROLE_PRIORITY[a] >= ROLE_PRIORITY[b] ? a : b;
}

// Prefer a longer, non-empty string when merging free-text fields.
function richer(a: string | null, b: string | null): string | null {
  if (a && b) return a.length >= b.length ? a : b;
  return a ?? b ?? null;
}

function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].filter(Boolean);
}

function toDeduped(raw: InputSpeaker): DedupedSpeaker {
  const name = normalizeName(raw.name);
  const company = normalizeCompanyDisplay(raw.company ?? null);
  const sourceUrls = union(raw.sourceUrls, raw.sourceUrl ? [raw.sourceUrl] : []);
  return {
    key: personKey(raw.name, raw.company ?? null),
    name,
    originalName: raw.name,
    title: normalizeTitle(raw.title ?? null),
    company,
    companyKey: companyKey(raw.company ?? null),
    bio: raw.bio ?? null,
    role: raw.role,
    topics: [...new Set(raw.topics.map((t) => t.trim().toLowerCase()))].filter(
      Boolean,
    ),
    sessionSourceIds: [...new Set(raw.sessionSourceIds)],
    sourceUrls,
    mergedSourceIds: [raw.sourceId],
    extractionConfidence: raw.extractionConfidence,
  };
}

function merge(base: DedupedSpeaker, next: DedupedSpeaker): DedupedSpeaker {
  return {
    key: base.key,
    // Keep the longer/more-complete display name.
    name: base.name.length >= next.name.length ? base.name : next.name,
    originalName: base.originalName,
    title: richer(base.title, next.title),
    company: richer(base.company, next.company),
    companyKey: base.companyKey ?? next.companyKey,
    bio: richer(base.bio, next.bio),
    role: betterRole(base.role, next.role),
    topics: union(base.topics, next.topics),
    sessionSourceIds: union(base.sessionSourceIds, next.sessionSourceIds),
    sourceUrls: union(base.sourceUrls, next.sourceUrls),
    mergedSourceIds: union(base.mergedSourceIds, next.mergedSourceIds),
    // Confidence in the merged record is the strongest single observation.
    extractionConfidence: Math.max(
      base.extractionConfidence,
      next.extractionConfidence,
    ),
  };
}

/**
 * Clean and deduplicate scraped speakers. Records that resolve to the same
 * person (same normalized name + company) are merged, unioning their evidence,
 * sessions, and topics. Records with an empty name after normalization are
 * dropped (unusable). Output order is stable by first appearance.
 */
export function dedupeSpeakers(speakers: InputSpeaker[]): DedupedSpeaker[] {
  const byKey = new Map<string, DedupedSpeaker>();
  const order: string[] = [];

  for (const raw of speakers) {
    const cleaned = toDeduped(raw);
    if (!cleaned.name || !cleaned.key) continue;

    const existing = byKey.get(cleaned.key);
    if (existing) {
      byKey.set(cleaned.key, merge(existing, cleaned));
    } else {
      byKey.set(cleaned.key, cleaned);
      order.push(cleaned.key);
    }
  }

  return order.map((key) => byKey.get(key)!);
}

export interface DedupedCompany {
  companyKey: string;
  displayName: string;
  speakerKeys: string[];
}

/**
 * Roll deduplicated speakers up into a deduplicated company list. The canonical
 * `companyKey` collapses legal-suffix variations; the display name prefers the
 * most complete surface form seen.
 */
export function dedupeCompanies(speakers: DedupedSpeaker[]): DedupedCompany[] {
  const byKey = new Map<string, DedupedCompany>();
  const order: string[] = [];

  for (const speaker of speakers) {
    if (!speaker.companyKey || !speaker.company) continue;
    const existing = byKey.get(speaker.companyKey);
    if (existing) {
      if (speaker.company.length > existing.displayName.length) {
        existing.displayName = speaker.company;
      }
      if (!existing.speakerKeys.includes(speaker.key)) {
        existing.speakerKeys.push(speaker.key);
      }
    } else {
      byKey.set(speaker.companyKey, {
        companyKey: speaker.companyKey,
        displayName: speaker.company,
        speakerKeys: [speaker.key],
      });
      order.push(speaker.companyKey);
    }
  }

  return order.map((key) => byKey.get(key)!);
}
