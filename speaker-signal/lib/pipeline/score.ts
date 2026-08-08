import type { Evidence, ScoreBreakdown } from "../contracts";
import type { Candidate, PersonRole } from "./dedupe";
import type { RawConference } from "./ingestion";
import {
  BUYING_INFLUENCE,
  NEGATIVE_COMPANY,
  SENIORITY_TIERS,
  TARGET_THEMES,
  TIER_THRESHOLDS,
} from "./icp-config";

export type Tier = "A" | "B" | "C" | "D";

export interface ScoredCandidate {
  candidate: Candidate;
  breakdown: ScoreBreakdown;
  total: number;
  tier: Tier;
  matchedThemes: string[];
  evidence: Evidence[];
  deterministicConfidence: number;
}

const ROLE_FIT_BASE: Record<PersonRole, number> = {
  speaker: 16,
  moderator: 14,
  unknown: 10,
  sponsor: 8,
  exhibitor: 6,
  staff: 6,
  journalist: 3,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function firstMatchScore(
  text: string,
  tiers: { patterns: RegExp[]; score: number }[],
  fallback: number,
): number {
  for (const tier of tiers) {
    if (tier.patterns.some((p) => p.test(text))) return tier.score;
  }
  return fallback;
}

/** 0-15 from the job title. */
export function seniorityScore(title: string | null): number {
  if (!title) return 3;
  return firstMatchScore(title, SENIORITY_TIERS, 4);
}

/** 0-10 from the functional area implied by the title. */
export function buyingInfluenceScore(title: string | null): number {
  if (!title) return 4;
  return firstMatchScore(title, BUYING_INFLUENCE, 4);
}

/** 0-20: is this person a decision-influencing speaker (vs sponsor/press)? */
export function roleFitScore(candidate: Candidate): number {
  let score = ROLE_FIT_BASE[candidate.role] ?? 10;
  const title = candidate.title ?? "";
  if (/\bchief\b|\bc[eiofmt]o\b|\bhead\b|\bvp\b|\bvice president\b|\bdirector\b|\bowner\b|\bfounder\b|\bpresident\b/i.test(title)) {
    score += 4;
  }
  return clamp(score, 0, 20);
}

/** 0-20: does the company look like an ICP org (owner/developer/utility/infra)? */
export function companyFitScore(candidate: Candidate): number {
  const company = candidate.company ?? "";
  if (!company) return 8;
  if (NEGATIVE_COMPANY.some((p) => p.test(company))) return 3;

  const haystack = `${company} ${candidate.bio ?? ""}`.toLowerCase();
  let weight = 0;
  for (const theme of TARGET_THEMES) {
    if (haystack.includes(theme.term)) weight += theme.weight;
  }
  if (weight >= 6) return 20;
  if (weight >= 4) return 17;
  if (weight >= 2) return 13;
  if (weight >= 1) return 10;
  return 8;
}

/** 0-25 plus the matched theme list, from session titles/topics + speaker topics. */
export function topicRelevance(candidate: Candidate): {
  score: number;
  matched: string[];
} {
  const haystack = [
    ...candidate.topics,
    ...candidate.sessions.map((s) => s.title),
    ...candidate.sessions.flatMap((s) => s.topics),
  ]
    .join(" ")
    .toLowerCase();

  const matched = new Set<string>();
  let weight = 0;
  for (const theme of TARGET_THEMES) {
    if (haystack.includes(theme.term)) {
      weight += theme.weight;
      matched.add(theme.term);
    }
  }
  // Map accumulated weight to 0-25 with diminishing returns.
  const score = clamp(Math.round(weight >= 12 ? 25 : weight * 2.2), 0, 25);
  return { score: candidate.sessions.length || matched.size ? score : Math.min(score, 6), matched: [...matched] };
}

/** 0-10 from how close the conference is to today. */
export function eventProximity(
  conference: RawConference,
  now: Date = new Date(),
): number {
  if (!conference.startDate) return 3;
  const start = new Date(conference.startDate);
  if (Number.isNaN(start.getTime())) return 3;
  const days = Math.round((start.getTime() - now.getTime()) / 86_400_000);
  if (days < -3) return 1; // already happened
  if (days <= 14) return 10;
  if (days <= 30) return 8;
  if (days <= 60) return 6;
  if (days <= 90) return 4;
  if (days <= 180) return 2;
  return 1;
}

function tierFor(total: number): Tier {
  if (total >= TIER_THRESHOLDS.A) return "A";
  if (total >= TIER_THRESHOLDS.B) return "B";
  if (total >= TIER_THRESHOLDS.C) return "C";
  return "D";
}

function buildEvidence(candidate: Candidate): Evidence[] {
  const evidence: Evidence[] = [];
  for (const session of candidate.sessions.slice(0, 3)) {
    evidence.push({
      label: "Session",
      excerpt: session.title.slice(0, 200),
      sourceUrl: session.sourceUrl,
      confidence: session.confidence,
    });
  }
  if (candidate.title || candidate.company) {
    evidence.push({
      label: "Speaker profile",
      excerpt: [candidate.title, candidate.company]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 200),
      sourceUrl: candidate.primarySourceUrl,
      confidence: candidate.extractionConfidence,
    });
  }
  if (candidate.bio) {
    evidence.push({
      label: "Speaker bio",
      excerpt: candidate.bio.slice(0, 200),
      sourceUrl: candidate.primarySourceUrl,
      confidence: candidate.extractionConfidence,
    });
  }
  return evidence.length
    ? evidence
    : [
        {
          label: "Source",
          excerpt: candidate.name,
          sourceUrl: candidate.primarySourceUrl,
          confidence: candidate.extractionConfidence,
        },
      ];
}

/**
 * Transparent, additive score. Components sum to a maximum of 100:
 * roleFit(20) + companyFit(20) + topicRelevance(25) + seniority(15) +
 * buyingInfluence(10) + eventProximity(10).
 */
export function scoreCandidate(
  candidate: Candidate,
  conference: RawConference,
  now: Date = new Date(),
): ScoredCandidate {
  const topic = topicRelevance(candidate);
  const breakdown: ScoreBreakdown = {
    roleFit: roleFitScore(candidate),
    companyFit: companyFitScore(candidate),
    topicRelevance: topic.score,
    seniority: seniorityScore(candidate.title),
    buyingInfluence: buyingInfluenceScore(candidate.title),
    eventProximity: eventProximity(conference, now),
  };
  const total = clamp(
    breakdown.roleFit +
      breakdown.companyFit +
      breakdown.topicRelevance +
      breakdown.seniority +
      breakdown.buyingInfluence +
      breakdown.eventProximity,
    0,
    100,
  );

  return {
    candidate,
    breakdown,
    total,
    tier: tierFor(total),
    matchedThemes: topic.matched,
    evidence: buildEvidence(candidate),
    deterministicConfidence: candidate.extractionConfidence,
  };
}
