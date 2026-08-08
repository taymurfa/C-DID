import type { Evidence, QualifiedLead, QualifyResponse, ScoreBreakdown } from "./contracts";
import type { IngestionResult } from "./pipeline/ingestion";

/**
 * Agent 2 (intelligence-service) lead shape — kept loose so dashboard Zod stays
 * the source of truth after mapping.
 */
type Agent2Lead = {
  leadId?: string;
  name?: string;
  title?: string | null;
  company?: string | null;
  role?: string;
  topics?: string[];
  sessionTitles?: string[];
  sourceUrls?: string[];
  scores?: {
    total?: number;
    roleFit?: number;
    companyIcpFit?: number;
    seniority?: number;
    topicRelevance?: number;
    buyingInfluence?: number;
    confidence?: number;
  };
  tier?: "A" | "B" | "C" | "D";
  qualified?: boolean;
  whyThisPersonMatters?: string;
  evidence?: string[];
  icpSource?: string;
};

type Agent2Result = {
  qualificationId?: string;
  sourceRunId?: string | null;
  conferenceName?: string | null;
  totals?: {
    speakersIn?: number;
    afterDedup?: number;
    qualified?: number;
    companies?: number;
  };
  icpEnrichment?: "openai" | "deterministic";
  leads?: Agent2Lead[];
};

function scale(unit: number | undefined, max: number): number {
  if (typeof unit !== "number" || Number.isNaN(unit)) return 0;
  return Math.round(Math.max(0, Math.min(1, unit)) * max);
}

function toBreakdown(scores: Agent2Lead["scores"]): ScoreBreakdown {
  return {
    roleFit: scale(scores?.roleFit, 20),
    companyFit: scale(scores?.companyIcpFit, 20),
    topicRelevance: scale(scores?.topicRelevance, 25),
    seniority: scale(scores?.seniority, 15),
    buyingInfluence: scale(scores?.buyingInfluence, 10),
    // Agent 2 has no separate eventProximity; fold confidence into the slot.
    eventProximity: scale(scores?.confidence, 10),
  };
}

function toEvidence(
  lead: Agent2Lead,
  fallbackUrl: string,
): Evidence[] {
  const urls = lead.sourceUrls?.filter(Boolean) ?? [];
  const labels = lead.evidence?.filter(Boolean) ?? [];
  if (labels.length === 0 && urls.length === 0) {
    return [
      {
        label: "Source",
        excerpt: lead.whyThisPersonMatters || "Qualified by Agent 2",
        sourceUrl: fallbackUrl,
        confidence: lead.scores?.confidence ?? 0.5,
      },
    ];
  }
  const count = Math.max(labels.length, urls.length, 1);
  const out: Evidence[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      label: labels[i] || `Evidence ${i + 1}`,
      excerpt: labels[i] || lead.whyThisPersonMatters || "",
      sourceUrl: urls[i] || urls[0] || fallbackUrl,
      confidence: lead.scores?.confidence ?? 0.6,
    });
  }
  return out;
}

const ROLE_SET = new Set([
  "speaker",
  "moderator",
  "sponsor",
  "staff",
  "exhibitor",
  "journalist",
  "unknown",
]);

/**
 * Map Agent 2 `/qualify` JSON into the Signal Desk `QualifyResponse` contract.
 */
export function mapIntelligenceToQualifyResponse(
  agent2: unknown,
  ingestion: IngestionResult,
  mode: "live" | "demo" = "live",
): QualifyResponse {
  const raw = (agent2 ?? {}) as Agent2Result;
  const conferenceName =
    raw.conferenceName ??
    ingestion.conference.name ??
    (() => {
      try {
        return new URL(ingestion.conference.websiteUrl).hostname;
      } catch {
        return ingestion.conference.websiteUrl;
      }
    })();

  const websiteUrl = ingestion.conference.websiteUrl;
  const leads: QualifiedLead[] = (raw.leads ?? [])
    .filter((l) => l && typeof l.name === "string")
    .map((lead, index) => {
      const role = ROLE_SET.has(String(lead.role))
        ? (lead.role as QualifiedLead["role"])
        : "unknown";
      const tier = (lead.tier ?? "D") as QualifiedLead["tier"];
      const score = Math.round(lead.scores?.total ?? 0);
      return {
        id: lead.leadId || `lead-${index + 1}`,
        name: lead.name!,
        title: lead.title ?? null,
        company: lead.company ?? null,
        conference: conferenceName,
        session: lead.sessionTitles?.[0] ?? null,
        score,
        tier,
        scoreReason: lead.whyThisPersonMatters || "Scored by Agent 2",
        confidence: Number((lead.scores?.confidence ?? 0.5).toFixed(3)),
        scoreBreakdown: toBreakdown(lead.scores),
        evidence: toEvidence(lead, websiteUrl),
        outreachStage: "Identified" as const,
        role,
        normalizedCompany: lead.company ?? null,
        topics: lead.topics ?? [],
        isICP: Boolean(lead.qualified) || score >= 45,
        rank: index + 1,
      };
    })
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .map((lead, index) => ({ ...lead, rank: index + 1 }));

  return {
    mode,
    conference: {
      name: ingestion.conference.name ?? conferenceName,
      websiteUrl,
      startDate: ingestion.conference.startDate,
      endDate: ingestion.conference.endDate,
      location: ingestion.conference.location,
    },
    stats: {
      speakersIngested: raw.totals?.speakersIn ?? ingestion.speakers.length,
      afterDedupe: raw.totals?.afterDedup ?? leads.length,
      qualified: raw.totals?.qualified ?? leads.length,
      companiesFound: raw.totals?.companies ?? 0,
      scoredWithOpenAI: raw.icpEnrichment === "openai",
    },
    leads,
  };
}
