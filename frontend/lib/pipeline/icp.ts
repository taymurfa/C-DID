import { z } from "zod";
import type { RawConference } from "./ingestion";
import type { ScoredCandidate } from "./score";
import { chatJson, isOpenAiEnabled } from "./openai";

export interface IcpAssessment {
  icpFit: number; // 0-1
  isICP: boolean;
  reason: string; // "Why this person matters"
  source: "openai" | "deterministic";
}

const LlmItem = z.object({
  id: z.string(),
  icpFit: z.number().min(0).max(1),
  isICP: z.boolean(),
  reason: z.string().min(1),
});
const LlmResponse = z.object({ assessments: z.array(LlmItem) });

function seniorityWord(seniority: number): string {
  if (seniority >= 15) return "C-suite / owner-level";
  if (seniority >= 13) return "senior executive";
  if (seniority >= 11) return "director-level";
  if (seniority >= 8) return "senior";
  return "operational";
}

function influenceWord(influence: number): string {
  if (influence >= 10) return "direct procurement authority";
  if (influence >= 9) return "project origination influence";
  if (influence >= 8) return "delivery / infrastructure ownership";
  if (influence >= 7) return "capital / strategy influence";
  return "technical influence";
}

/** Deterministic, evidence-grounded fallback for "why this person matters". */
export function deterministicReason(scored: ScoredCandidate): string {
  const { candidate, breakdown, matchedThemes, tier } = scored;
  const roleDesc = `${seniorityWord(breakdown.seniority)} leader`;
  const where = candidate.company ? ` at ${candidate.company}` : "";
  const focus = matchedThemes.length
    ? matchedThemes.slice(0, 3).join(", ")
    : candidate.sessions[0]?.title;
  const influence = influenceWord(breakdown.buyingInfluence);
  const topicClause = focus
    ? ` speaking on ${focus}`
    : " with no clearly relevant session topic yet";
  const tierClause =
    tier === "D"
      ? " Weak ICP alignment on current evidence."
      : ` Strong fit: ${influence}.`;
  return `${candidate.title ?? roleDesc}${where}${topicClause}.${tierClause}`.trim();
}

function deterministicAssessment(scored: ScoredCandidate): IcpAssessment {
  return {
    icpFit: Number((scored.total / 100).toFixed(3)),
    isICP: scored.tier !== "D",
    reason: deterministicReason(scored),
    source: "deterministic",
  };
}

/**
 * Assess ICP fit and produce the "why this person matters" narrative for each
 * scored candidate. Uses OpenAI in a single batched call when available, and
 * always falls back to the deterministic assessment per-candidate if the model
 * is disabled, errors, or omits an id.
 */
export async function assessIcpBatch(
  scored: ScoredCandidate[],
  conference: RawConference,
): Promise<Map<string, IcpAssessment>> {
  const result = new Map<string, IcpAssessment>();
  for (const s of scored) {
    result.set(s.candidate.id, deterministicAssessment(s));
  }

  if (!isOpenAiEnabled() || scored.length === 0) return result;

  const system =
    "You qualify conference speakers as sales leads for Candid Intelligence, " +
    "an owner's-engineering / project-delivery advisor for energy, power, " +
    "grid, and data-center infrastructure. The ICP is a senior decision-maker " +
    "(VP/Director/Chief/Head/Owner) at an organization that OWNS, DEVELOPS, " +
    "FINANCES, or DELIVERS such infrastructure. Exclude vendors of unrelated " +
    "software, press, academics, and junior staff. Judge only from the given " +
    "facts; never invent employers or claims. Return strict JSON.";

  const payload = scored.map((s) => ({
    id: s.candidate.id,
    name: s.candidate.name,
    title: s.candidate.title,
    company: s.candidate.company,
    role: s.candidate.role,
    topics: s.candidate.topics.slice(0, 8),
    sessions: s.candidate.sessions.map((x) => x.title).slice(0, 4),
    bio: s.candidate.bio?.slice(0, 300) ?? null,
  }));

  const user =
    `Conference: ${conference.name ?? conference.websiteUrl}\n` +
    `Location: ${conference.location ?? "unknown"}\n\n` +
    "For each candidate return an object with: id, icpFit (0-1), isICP " +
    "(boolean), reason (one or two sentences on WHY THIS PERSON MATTERS to " +
    "Candid, grounded in their title/company/session). Respond as JSON: " +
    '{"assessments":[...]}.\n\nCandidates:\n' +
    JSON.stringify(payload);

  const raw = await chatJson(system, user);
  const parsed = LlmResponse.safeParse(raw);
  if (!parsed.success) return result;

  for (const item of parsed.data.assessments) {
    if (!result.has(item.id)) continue;
    result.set(item.id, {
      icpFit: item.icpFit,
      isICP: item.isICP,
      reason: item.reason,
      source: "openai",
    });
  }
  return result;
}
