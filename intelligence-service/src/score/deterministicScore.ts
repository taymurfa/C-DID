import type { InputSession } from "../schemas/ingestionInput.js";
import type { SeniorityLevel } from "../schemas/lead.js";
import type { DedupedSpeaker } from "../dedupe/dedupe.js";
import { assessSeniority } from "./seniority.js";
import { ICP_KEYWORDS, ICP_TOPICS } from "./icpConfig.js";

export interface ScoreContext {
  /** sourceId -> session, so we can pull session topics/titles per speaker. */
  sessionsById: Map<string, InputSession>;
}

export function buildScoreContext(sessions: InputSession[]): ScoreContext {
  return {
    sessionsById: new Map(sessions.map((s) => [s.sourceId, s])),
  };
}

export interface SpeakerScoreParts {
  roleFit: number;
  companyIcpFit: number;
  seniority: number;
  topicRelevance: number;
  buyingInfluence: number;
  confidence: number;
  // Supporting detail used by the explanation layer.
  seniorityLevel: SeniorityLevel;
  seniorityLabel: string;
  matchedTopics: string[];
  matchedKeywords: string[];
  sessionTitles: string[];
}

const ROLE_FIT: Record<string, number> = {
  speaker: 1,
  moderator: 0.85,
  unknown: 0.5,
  journalist: 0.25,
  exhibitor: 0.35,
  sponsor: 0.3,
  staff: 0.2,
};

function uniqueMatches(haystack: string, needles: string[]): string[] {
  const found = new Set<string>();
  for (const needle of needles) {
    if (haystack.includes(needle)) found.add(needle);
  }
  return [...found];
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Compute the six deterministic 0..1 signals for one speaker. `companyIcpFit`
 * here is the keyword-based baseline; the OpenAI layer may override it later.
 */
export function scoreSpeakerDeterministic(
  speaker: DedupedSpeaker,
  ctx: ScoreContext,
): SpeakerScoreParts {
  const sessions = speaker.sessionSourceIds
    .map((id) => ctx.sessionsById.get(id))
    .filter((s): s is InputSession => Boolean(s));

  const sessionTitles = sessions.map((s) => s.title).filter(Boolean);
  const sessionTopics = sessions.flatMap((s) => s.topics);
  const allTopics = [
    ...new Set(
      [...speaker.topics, ...sessionTopics].map((t) => t.trim().toLowerCase()),
    ),
  ].filter(Boolean);

  // --- topic relevance -----------------------------------------------------
  const matchedTopics = allTopics.filter((t) => ICP_TOPICS.includes(t));
  const topicText = [
    speaker.title ?? "",
    speaker.bio ?? "",
    ...sessionTitles,
    ...sessions.map((s) => s.description ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  const topicKeywordMatches = uniqueMatches(topicText, ICP_KEYWORDS);
  const topicSignal = matchedTopics.length * 2 + topicKeywordMatches.length;
  const topicRelevance = clamp01(topicSignal / 6);

  // --- company ICP fit (deterministic baseline) ----------------------------
  const companyName = (speaker.company ?? "").toLowerCase();
  const companyKeywordMatches = uniqueMatches(companyName, ICP_KEYWORDS);
  const bioKeywordMatches = uniqueMatches(
    (speaker.bio ?? "").toLowerCase(),
    ICP_KEYWORDS,
  );
  let companyIcpFit: number;
  if (!speaker.company) {
    // No company at all: weak, rely on topical/bio signal only.
    companyIcpFit = clamp01(0.1 + bioKeywordMatches.length * 0.1);
  } else {
    companyIcpFit = clamp01(
      0.25 +
        companyKeywordMatches.length * 0.35 +
        bioKeywordMatches.length * 0.1 +
        matchedTopics.length * 0.1,
    );
  }
  const matchedKeywords = [
    ...new Set([...companyKeywordMatches, ...bioKeywordMatches, ...topicKeywordMatches]),
  ];

  // --- role, seniority, buying influence, confidence ------------------------
  const roleFit = ROLE_FIT[speaker.role] ?? 0.5;
  const seniority = assessSeniority(speaker.title);
  const confidence = clamp01(speaker.extractionConfidence);

  return {
    roleFit,
    companyIcpFit,
    seniority: seniority.seniorityScore,
    topicRelevance,
    buyingInfluence: seniority.buyingInfluence,
    confidence,
    seniorityLevel: seniority.level,
    seniorityLabel: seniority.label,
    matchedTopics,
    matchedKeywords,
    sessionTitles,
  };
}
