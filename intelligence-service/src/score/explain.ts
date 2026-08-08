import type { DedupedSpeaker } from "../dedupe/dedupe.js";
import type { LeadScores } from "../schemas/lead.js";
import type { SpeakerScoreParts } from "./deterministicScore.js";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Build the human-facing "why this person matters" narrative. Prefers OpenAI's
 * ICP reason when available, and always appends the concrete signals (seniority,
 * matched ICP topics, company) so the claim is grounded and auditable.
 */
export function buildWhyThisPersonMatters(
  speaker: DedupedSpeaker,
  parts: SpeakerScoreParts,
  scores: LeadScores,
  icpReason: string | null,
): string {
  const sentences: string[] = [];

  const who = [speaker.title, speaker.company ? `at ${speaker.company}` : null]
    .filter(Boolean)
    .join(" ");
  sentences.push(
    who
      ? `${speaker.name} is ${who}.`
      : `${speaker.name} is a speaker at this event.`,
  );

  sentences.push(`${parts.seniorityLabel}, so buying influence reads as ${pct(
    parts.buyingInfluence,
  )}.`);

  if (icpReason) {
    sentences.push(`ICP fit: ${icpReason}`);
  } else if (parts.matchedKeywords.length) {
    sentences.push(
      `Company/role signals align with our ICP (${parts.matchedKeywords
        .slice(0, 4)
        .join(", ")}).`,
    );
  } else {
    sentences.push(`Limited explicit ICP signal in the scraped data.`);
  }

  if (parts.matchedTopics.length) {
    sentences.push(
      `Speaks on ICP-relevant topics: ${parts.matchedTopics
        .slice(0, 5)
        .join(", ")}.`,
    );
  }

  sentences.push(`Overall lead score ${Math.round(scores.total)}/100.`);
  return sentences.join(" ");
}

/**
 * Assemble the auditable evidence list: concrete facts and source URLs that
 * back the score. Everything here comes straight from the scraped record.
 */
export function buildEvidence(
  speaker: DedupedSpeaker,
  parts: SpeakerScoreParts,
): string[] {
  const evidence: string[] = [];

  if (speaker.title) evidence.push(`Title: ${speaker.title}`);
  if (speaker.company) evidence.push(`Company: ${speaker.company}`);
  evidence.push(`Role on site: ${speaker.role}`);

  if (parts.sessionTitles.length) {
    evidence.push(
      `Sessions: ${parts.sessionTitles.slice(0, 3).join(" | ")}`,
    );
  }
  if (parts.matchedTopics.length) {
    evidence.push(`ICP topics: ${parts.matchedTopics.join(", ")}`);
  }
  if (parts.matchedKeywords.length) {
    evidence.push(`ICP keywords: ${parts.matchedKeywords.slice(0, 6).join(", ")}`);
  }
  if (speaker.mergedSourceIds.length > 1) {
    evidence.push(
      `Merged from ${speaker.mergedSourceIds.length} scraped records`,
    );
  }
  for (const url of speaker.sourceUrls.slice(0, 5)) {
    evidence.push(`Source: ${url}`);
  }
  return evidence;
}
