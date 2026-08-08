import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import {
  IngestionInputSchema,
  type IngestionInput,
} from "../schemas/ingestionInput.js";
import type {
  CompanyAggregate,
  LeadScores,
  LeadTier,
  QualificationError,
  QualificationResult,
  QualifiedLead,
} from "../schemas/lead.js";
import { dedupeCompanies, dedupeSpeakers } from "../dedupe/dedupe.js";
import {
  buildScoreContext,
  scoreSpeakerDeterministic,
} from "../score/deterministicScore.js";
import { judgeIcpFit } from "../score/icpOpenai.js";
import { buildEvidence, buildWhyThisPersonMatters } from "../score/explain.js";
import { SCORE_WEIGHTS, TIER_CUTOFFS } from "../score/icpConfig.js";

export interface RunOptions {
  minScore?: number;
  useOpenAi?: boolean;
}

function tierFor(total: number): LeadTier {
  if (total >= TIER_CUTOFFS.A) return "A";
  if (total >= TIER_CUTOFFS.B) return "B";
  if (total >= TIER_CUTOFFS.C) return "C";
  return "D";
}

function weightedTotal(scores: Omit<LeadScores, "total">): number {
  const blend =
    scores.roleFit * SCORE_WEIGHTS.roleFit +
    scores.companyIcpFit * SCORE_WEIGHTS.companyIcpFit +
    scores.seniority * SCORE_WEIGHTS.seniority +
    scores.topicRelevance * SCORE_WEIGHTS.topicRelevance +
    scores.buyingInfluence * SCORE_WEIGHTS.buyingInfluence +
    scores.confidence * SCORE_WEIGHTS.confidence;
  return Math.round(blend * 1000) / 10; // 0..100, one decimal
}

/**
 * The Agent 2 pipeline: raw ingestion payload -> cleaned, deduplicated,
 * ICP-scored, ranked qualified leads with explanations and evidence.
 *
 * Degrades gracefully: invalid input yields an empty result + an error entry
 * (never throws); OpenAI is optional (deterministic scoring is the fallback).
 */
export async function runQualification(
  rawInput: unknown,
  options: RunOptions = {},
): Promise<QualificationResult> {
  const errors: QualificationError[] = [];
  const qualificationId = randomUUID();

  const parsed = IngestionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    errors.push({
      stage: "parse",
      message: `Invalid ingestion payload: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 5)
        .join("; ")}`,
    });
    return emptyResult(qualificationId, null, null, errors);
  }

  const input: IngestionInput = parsed.data;
  const minScore = options.minScore ?? env.qualify.minScore;

  const deduped = dedupeSpeakers(input.speakers);
  const eligibleRoles = new Set(env.qualify.eligibleRoles);
  const eligible = deduped.filter((s) => eligibleRoles.has(s.role));

  const ctx = buildScoreContext(input.sessions);

  // Deterministic scoring for every eligible speaker.
  const parts = new Map(
    eligible.map((s) => [s.key, scoreSpeakerDeterministic(s, ctx)]),
  );

  // Optional OpenAI ICP refinement of the company-fit signal.
  const wantOpenAi = options.useOpenAi ?? true;
  let judgments: Awaited<ReturnType<typeof judgeIcpFit>> = null;
  if (wantOpenAi) {
    judgments = await judgeIcpFit(eligible);
  }
  const icpEnrichment: "openai" | "deterministic" = judgments
    ? "openai"
    : "deterministic";

  const leads: QualifiedLead[] = eligible.map((speaker) => {
    const p = parts.get(speaker.key)!;
    const judgment = judgments?.get(speaker.key) ?? null;
    const icpSource: "openai" | "deterministic" = judgment
      ? "openai"
      : "deterministic";
    const companyIcpFit = judgment ? judgment.icpFit : p.companyIcpFit;

    const scoreParts = {
      roleFit: p.roleFit,
      companyIcpFit,
      seniority: p.seniority,
      topicRelevance: p.topicRelevance,
      buyingInfluence: p.buyingInfluence,
      confidence: p.confidence,
    };
    const total = weightedTotal(scoreParts);
    const scores: LeadScores = { total, ...scoreParts };

    return {
      leadId: randomUUID(),
      name: speaker.name,
      originalName: speaker.originalName,
      title: speaker.title,
      company: speaker.company,
      companyKey: speaker.companyKey,
      role: speaker.role,
      seniority: p.seniorityLevel,
      topics: speaker.topics,
      sessionTitles: p.sessionTitles,
      sourceUrls: speaker.sourceUrls,
      scores,
      tier: tierFor(total),
      qualified: total >= minScore,
      whyThisPersonMatters: buildWhyThisPersonMatters(
        speaker,
        p,
        scores,
        judgment?.reason || null,
      ),
      evidence: buildEvidence(speaker, p),
      icpSource,
      mergedSourceIds: speaker.mergedSourceIds,
    };
  });

  // Rank: score desc, then buying influence, then confidence.
  leads.sort(
    (a, b) =>
      b.scores.total - a.scores.total ||
      b.scores.buyingInfluence - a.scores.buyingInfluence ||
      b.scores.confidence - a.scores.confidence ||
      a.name.localeCompare(b.name),
  );

  const companies = buildCompanyAggregates(leads, deduped);

  const result: QualificationResult = {
    qualificationId,
    sourceRunId: input.runId ?? null,
    conferenceName: input.conference?.name ?? null,
    totals: {
      speakersIn: input.speakers.length,
      afterDedup: deduped.length,
      eligible: eligible.length,
      qualified: leads.filter((l) => l.qualified).length,
      companies: companies.length,
    },
    icpEnrichment,
    leads,
    companies,
    errors,
  };

  return result;
}

function buildCompanyAggregates(
  leads: QualifiedLead[],
  deduped: ReturnType<typeof dedupeSpeakers>,
): CompanyAggregate[] {
  const companies = dedupeCompanies(deduped);
  return companies
    .map((company) => {
      const companyLeads = leads.filter(
        (l) => l.companyKey === company.companyKey,
      );
      const icpFit = companyLeads.length
        ? Math.max(...companyLeads.map((l) => l.scores.companyIcpFit))
        : 0;
      const top = companyLeads[0] ?? null;
      return {
        companyKey: company.companyKey,
        displayName: company.displayName,
        leadCount: companyLeads.length,
        icpFit,
        topLeadName: top ? top.name : null,
      };
    })
    .sort((a, b) => b.icpFit - a.icpFit || b.leadCount - a.leadCount);
}

function emptyResult(
  qualificationId: string,
  sourceRunId: string | null,
  conferenceName: string | null,
  errors: QualificationError[],
): QualificationResult {
  return {
    qualificationId,
    sourceRunId,
    conferenceName,
    totals: {
      speakersIn: 0,
      afterDedup: 0,
      eligible: 0,
      qualified: 0,
      companies: 0,
    },
    icpEnrichment: "deterministic",
    leads: [],
    companies: [],
    errors,
  };
}
