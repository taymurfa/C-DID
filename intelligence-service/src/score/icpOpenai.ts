import { z } from "zod";
import { env } from "../config/env.js";
import { chatJson, isOpenAiEnabled } from "../openai/openaiClient.js";
import type { DedupedSpeaker } from "../dedupe/dedupe.js";
import { ICP_TOPICS } from "./icpConfig.js";

export interface IcpJudgment {
  icpFit: number;
  reason: string;
}

const LlmResult = z.object({
  results: z
    .array(
      z.object({
        index: z.number().int(),
        icpFit: z.number().min(0).max(1),
        reason: z.string().optional(),
      }),
    )
    .optional(),
});

const SYSTEM_PROMPT = `You are Agent 2, a precise B2B sales-intelligence analyst.
Our Ideal Customer Profile (ICP) is decision-makers at organizations involved in
ENERGY, POWER, ELECTRICITY, GRID / TRANSMISSION, UTILITIES, DATA CENTERS, and the
INFRASTRUCTURE / EPC / DEVELOPMENT that powers them (canonical topics: ${ICP_TOPICS.join(
  ", ",
)}).

For each candidate you are given (name, title, company, bio, session titles),
judge how well their COMPANY and ROLE fit that ICP as a potential buyer or
influencer of energy/data-center infrastructure. Consider what the company does,
not just keywords. A pure consumer-tech or unrelated company scores low even if
the person is senior.

Return STRICT JSON: {"results":[{"index":<int>,"icpFit":<0..1>,"reason":"<=160 chars"}]}.
- icpFit is a 0..1 float (1 = perfect ICP company & buyer, 0 = clearly irrelevant).
- reason is a short, factual justification grounded ONLY in the provided data.
- Never invent facts not present in the candidate. Include every index exactly once.`;

/**
 * Ask OpenAI to score ICP fit for a batch of candidates. Returns a Map keyed by
 * speaker.key, or null if OpenAI is disabled or the call fails (callers then
 * keep the deterministic baseline). Never throws.
 */
export async function judgeIcpFit(
  speakers: DedupedSpeaker[],
): Promise<Map<string, IcpJudgment> | null> {
  if (!isOpenAiEnabled() || speakers.length === 0) return null;

  const batch = speakers.slice(0, env.qualify.openaiMaxLeads);
  const candidates = batch.map((s, index) => ({
    index,
    name: s.name,
    title: s.title,
    company: s.company,
    bio: s.bio ? s.bio.slice(0, 400) : null,
    topics: s.topics.slice(0, 8),
  }));

  const raw = await chatJson(
    SYSTEM_PROMPT,
    "Score these candidates for ICP fit. Return one result per index.\n\n" +
      `CANDIDATES:\n${JSON.stringify(candidates)}`,
    Math.min(4000, 200 + candidates.length * 60),
  );
  if (raw === null) return null;

  const parsed = LlmResult.safeParse(raw);
  if (!parsed.success || !parsed.data.results) return null;

  const byKey = new Map<string, IcpJudgment>();
  for (const r of parsed.data.results) {
    const speaker = batch[r.index];
    if (!speaker) continue;
    byKey.set(speaker.key, {
      icpFit: r.icpFit,
      reason: (r.reason ?? "").trim(),
    });
  }
  return byKey.size ? byKey : null;
}
