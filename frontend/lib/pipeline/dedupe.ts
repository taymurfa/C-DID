import type {
  IngestionResult,
  RawSession,
  RawSpeaker,
} from "./ingestion";
import {
  companyKey,
  normalizeCompany,
  normalizeName,
  normalizeTitle,
  personKey,
} from "./normalize";

export type PersonRole = RawSpeaker["role"];

export interface CandidateSession {
  title: string;
  topics: string[];
  sourceUrl: string;
  confidence: number;
}

export interface Candidate {
  id: string;
  sourceIds: string[];
  name: string;
  title: string | null;
  company: string | null;
  companyKey: string;
  bio: string | null;
  role: PersonRole;
  topics: string[];
  sessions: CandidateSession[];
  sourceUrls: string[];
  primarySourceUrl: string;
  extractionConfidence: number;
}

export interface DedupeResult {
  candidates: Candidate[];
  companies: { key: string; display: string; count: number }[];
  speakersIngested: number;
}

// Higher wins when merging duplicates with conflicting roles.
const ROLE_PRIORITY: Record<PersonRole, number> = {
  speaker: 6,
  moderator: 5,
  sponsor: 3,
  exhibitor: 3,
  staff: 2,
  journalist: 2,
  unknown: 1,
};

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "lead"
  );
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Normalize, deduplicate, and enrich raw speakers from an Agent 1 ingestion
 * payload. Speakers are grouped by (normalized name + company key); sessions are
 * attached both from the speaker's own links and via reverse lookup from
 * sessions that list the speaker.
 */
export function dedupeSpeakers(ingestion: IngestionResult): DedupeResult {
  const sessionById = new Map<string, RawSession>();
  for (const session of ingestion.sessions) {
    sessionById.set(session.sourceId, session);
  }

  // Reverse index: speaker sourceId -> sessions that reference it.
  const sessionsBySpeaker = new Map<string, RawSession[]>();
  for (const session of ingestion.sessions) {
    for (const speakerId of session.speakerSourceIds) {
      const list = sessionsBySpeaker.get(speakerId) ?? [];
      list.push(session);
      sessionsBySpeaker.set(speakerId, list);
    }
  }

  const groups = new Map<string, Candidate>();

  for (const speaker of ingestion.speakers) {
    const name = normalizeName(speaker.name);
    if (!name) continue;
    const company = normalizeCompany(speaker.company);
    const key = personKey(name, company) || slugify(name);

    const linkedSessions = uniq([
      ...speaker.sessionSourceIds,
      ...(sessionsBySpeaker.get(speaker.sourceId)?.map((s) => s.sourceId) ?? []),
    ])
      .map((id) => sessionById.get(id))
      .filter((s): s is RawSession => Boolean(s))
      .map<CandidateSession>((s) => ({
        title: s.title,
        topics: s.topics,
        sourceUrl: s.sourceUrl,
        confidence: s.extractionConfidence,
      }));

    const sessionTopics = linkedSessions.flatMap((s) => s.topics);

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        id: slugify(company ? `${name}-${company}` : name),
        sourceIds: [speaker.sourceId],
        name,
        title: normalizeTitle(speaker.title),
        company,
        companyKey: companyKey(company),
        bio: speaker.bio,
        role: speaker.role,
        topics: uniq([...speaker.topics, ...sessionTopics]),
        sessions: linkedSessions,
        sourceUrls: uniq([speaker.sourceUrl, ...speaker.sourceUrls]),
        primarySourceUrl: speaker.sourceUrl,
        extractionConfidence: speaker.extractionConfidence,
      });
      continue;
    }

    // Merge into the existing candidate.
    existing.sourceIds = uniq([...existing.sourceIds, speaker.sourceId]);
    existing.title = existing.title ?? normalizeTitle(speaker.title);
    existing.company = existing.company ?? company;
    if (!existing.companyKey) existing.companyKey = companyKey(company);
    if ((speaker.bio?.length ?? 0) > (existing.bio?.length ?? 0)) {
      existing.bio = speaker.bio;
    }
    if (ROLE_PRIORITY[speaker.role] > ROLE_PRIORITY[existing.role]) {
      existing.role = speaker.role;
    }
    existing.topics = uniq([
      ...existing.topics,
      ...speaker.topics,
      ...sessionTopics,
    ]);
    const mergedSessions = [...existing.sessions, ...linkedSessions];
    const seen = new Set<string>();
    existing.sessions = mergedSessions.filter((s) => {
      const k = `${s.title}::${s.sourceUrl}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    existing.sourceUrls = uniq([
      ...existing.sourceUrls,
      speaker.sourceUrl,
      ...speaker.sourceUrls,
    ]);
    existing.extractionConfidence = Math.max(
      existing.extractionConfidence,
      speaker.extractionConfidence,
    );
  }

  // Company rollup across deduped candidates.
  const companyMap = new Map<string, { display: string; count: number }>();
  for (const candidate of groups.values()) {
    if (!candidate.companyKey) continue;
    const entry = companyMap.get(candidate.companyKey);
    if (entry) {
      entry.count += 1;
    } else {
      companyMap.set(candidate.companyKey, {
        display: candidate.company ?? candidate.companyKey,
        count: 1,
      });
    }
  }

  return {
    candidates: [...groups.values()],
    companies: [...companyMap.entries()].map(([key, v]) => ({
      key,
      display: v.display,
      count: v.count,
    })),
    speakersIngested: ingestion.speakers.length,
  };
}
