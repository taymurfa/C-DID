import type { QualifiedLead } from "../contracts";
import { dedupeSpeakers } from "./dedupe";
import { assessIcpBatch } from "./icp";
import type { IngestionResult } from "./ingestion";
import { scoreCandidate, type Tier } from "./score";

export interface QualifyStats {
  speakersIngested: number;
  afterDedupe: number;
  qualified: number;
  companiesFound: number;
  scoredWithOpenAI: boolean;
}

export interface QualifyResult {
  conference: {
    name: string | null;
    websiteUrl: string;
    startDate: string | null;
    endDate: string | null;
    location: string | null;
  };
  stats: QualifyStats;
  leads: QualifiedLead[];
}

export interface QualifyOptions {
  now?: Date;
  minTier?: Tier;
}

const TIER_RANK: Record<Tier, number> = { A: 4, B: 3, C: 2, D: 1 };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Full Person 2 pipeline: normalize -> deduplicate -> deterministic score ->
 * OpenAI ICP fit + rationale -> ranked qualified leads. Turns noisy scraped
 * Agent 1 data into accurate, explainable sales intelligence.
 */
export async function qualify(
  ingestion: IngestionResult,
  options: QualifyOptions = {},
): Promise<QualifyResult> {
  const now = options.now ?? new Date();
  const minTier = options.minTier ?? "C";

  const deduped = dedupeSpeakers(ingestion);
  const scored = deduped.candidates.map((c) =>
    scoreCandidate(c, ingestion.conference, now),
  );

  const assessments = await assessIcpBatch(scored, ingestion.conference);
  const scoredWithOpenAI = [...assessments.values()].some(
    (a) => a.source === "openai",
  );

  const conferenceName =
    ingestion.conference.name ??
    (() => {
      try {
        return new URL(ingestion.conference.websiteUrl).hostname;
      } catch {
        return ingestion.conference.websiteUrl;
      }
    })();

  const leads: QualifiedLead[] = scored
    .map((s) => {
      const icp = assessments.get(s.candidate.id)!;
      const confidence = clamp01(
        0.6 * s.deterministicConfidence + 0.4 * icp.icpFit,
      );
      return {
        id: s.candidate.id,
        name: s.candidate.name,
        title: s.candidate.title,
        company: s.candidate.company,
        conference: conferenceName ?? ingestion.conference.websiteUrl,
        session: s.candidate.sessions[0]?.title ?? null,
        score: Math.round(s.total),
        tier: s.tier,
        scoreReason: icp.reason,
        confidence: Number(confidence.toFixed(3)),
        scoreBreakdown: s.breakdown,
        evidence: s.evidence,
        outreachStage: "Identified" as const,
        role: s.candidate.role,
        normalizedCompany: s.candidate.company,
        topics: s.candidate.topics,
        isICP: icp.isICP,
        rank: 0,
      };
    })
    .filter((lead) => TIER_RANK[lead.tier] >= TIER_RANK[minTier])
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .map((lead, index) => ({ ...lead, rank: index + 1 }));

  return {
    conference: {
      name: ingestion.conference.name,
      websiteUrl: ingestion.conference.websiteUrl,
      startDate: ingestion.conference.startDate,
      endDate: ingestion.conference.endDate,
      location: ingestion.conference.location,
    },
    stats: {
      speakersIngested: deduped.speakersIngested,
      afterDedupe: deduped.candidates.length,
      qualified: leads.length,
      companiesFound: deduped.companies.length,
      scoredWithOpenAI,
    },
    leads,
  };
}
