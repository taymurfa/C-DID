import { chatJson, isOpenAiEnabled } from "../openai/openaiClient.js";
import type {
  SequenceConference,
  SequenceDraft,
  SequenceLead,
  SequenceStep,
} from "../schemas/gtm.js";

export type SequenceLeadInput = SequenceLead;
export type SequenceConferenceInput = SequenceConference;

const ANCHORS = [
  { anchor: "T-14" as const, offsetDays: -14, label: "Context-first introduction", id: "initial" },
  { anchor: "T-7" as const, offsetDays: -7, label: "Relevant project insight", id: "value" },
  { anchor: "T-2" as const, offsetDays: -2, label: "Meet at the event", id: "meet" },
  { anchor: "Event" as const, offsetDays: 0, label: "In-person opportunity", id: "event" },
  { anchor: "T+2" as const, offsetDays: 2, label: "Post-event follow-up", id: "followup" },
];

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseConferenceStart(startDate: string): Date {
  const parsed = new Date(startDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid conference startDate: ${startDate}`);
  }
  return startOfUtcDay(parsed);
}

/**
 * Build the 5 event-anchored sequence steps (T−14 … T+2) from conference.startDate.
 * Past email touches → Sent; Event → Opportunity; next upcoming email → Scheduled;
 * later emails → Planned.
 */
export function generateSequence(
  lead: SequenceLeadInput,
  conference: SequenceConferenceInput,
  now: Date = new Date(),
): SequenceStep[] {
  const eventDay = parseConferenceStart(conference.startDate);
  const today = startOfUtcDay(now).getTime();

  const dated = ANCHORS.map((def) => {
    const scheduledFor = addDays(eventDay, def.offsetDays);
    scheduledFor.setUTCHours(15, 0, 0, 0);
    return { ...def, scheduledFor };
  });

  const nextUpcomingEmail = dated.find(
    (step) =>
      step.anchor !== "Event" && startOfUtcDay(step.scheduledFor).getTime() > today,
  );

  return dated.map((def) => {
    let status: SequenceStep["status"];
    if (def.anchor === "Event") {
      status = "Opportunity";
    } else if (startOfUtcDay(def.scheduledFor).getTime() <= today) {
      status = "Sent";
    } else if (nextUpcomingEmail && def.anchor === nextUpcomingEmail.anchor) {
      status = "Scheduled";
    } else {
      status = "Planned";
    }

    return {
      id: `${lead.id}-${def.id}`,
      anchor: def.anchor,
      label: def.label,
      scheduledFor: def.scheduledFor.toISOString(),
      subject: null as string | null,
      status,
    };
  });
}

function evidenceLabels(lead: SequenceLeadInput): string[] {
  const fromEvidence = (lead.evidence ?? [])
    .map((e) => e.label || e.sourceUrl)
    .filter((v): v is string => Boolean(v));
  const extras: string[] = [];
  if (lead.session) extras.push(`Session: ${lead.session}`);
  if (lead.topics?.length) extras.push(...lead.topics.map((t) => `Topic: ${t}`));
  return [...new Set([...fromEvidence, ...extras])];
}

function conferenceDisplayName(conference: SequenceConferenceInput): string {
  return conference.name?.trim() || "the conference";
}

function templateDraft(
  lead: SequenceLeadInput,
  conference: SequenceConferenceInput,
  step: SequenceStep,
): SequenceDraft {
  const groundedOn = evidenceLabels(lead);
  const session = lead.session ?? "your upcoming session";
  const company = lead.company ?? "your team";
  const confName = conferenceDisplayName(conference);
  const location = conference.location ? ` in ${conference.location}` : "";
  const topics = lead.topics?.length
    ? lead.topics.slice(0, 3).join(", ")
    : "the themes on the agenda";
  const firstName = lead.name.split(" ")[0] || lead.name;

  const templates: Record<SequenceStep["anchor"], { subject: string; body: string }> = {
    "T-14": {
      subject: `Your ${session} session`,
      body: `Hi ${firstName},\n\nYour session on ${session} at ${confName} caught my eye — especially given ${company}'s work around ${topics}.\n\nI'd welcome a brief exchange ahead of the event on how owners are navigating the same constraints.\n\nBest`,
    },
    "T-7": {
      subject: "A delivery pattern worth comparing",
      body: `Hi ${firstName},\n\nFollowing up on ${session}: we're seeing similar pressure around ${topics} with teams like ${company}.\n\nHappy to share a short comparison before ${confName} if useful.\n\nBest`,
    },
    "T-2": {
      subject: location ? `15 minutes${location}?` : "15 minutes at the event?",
      body: `Hi ${firstName},\n\nI'll be at ${confName}${location} and would value 15 minutes around your ${session} talk — grounded in what you've published on ${topics}.\n\nOpen to a hallway chat or a scheduled slot.\n\nBest`,
    },
    Event: {
      subject: `Meet at ${confName}`,
      body: `Hi ${firstName},\n\nLooking forward to ${session} today. If you're open, I'd like a short in-person conversation after the session about how ${company} is approaching ${topics}.\n\nI'll be nearby — happy to find a quiet corner.\n\nBest`,
    },
    "T+2": {
      subject: `Picking up our ${confName} conversation`,
      body: `Hi ${firstName},\n\nHope ${confName} went well. Your points on ${session} — especially around ${topics} — stuck with me.\n\nWorth a short follow-up on next steps for ${company}?\n\nBest`,
    },
  };

  const { subject, body } = templates[step.anchor];
  return {
    anchor: step.anchor,
    subject,
    body,
    groundedOn,
    generatedBy: "template",
  };
}

const DRAFT_SYSTEM = `You write short, professional B2B outreach emails for an energy infrastructure firm.
Return JSON: { "drafts": [ { "anchor": "T-14"|"T-7"|"T-2"|"Event"|"T+2", "subject": string, "body": string } ] }
Rules:
- Ground ONLY in the provided session, topics, evidence labels/excerpts, and conference facts.
- Do NOT invent titles, companies, projects, numbers, or claims not in the input.
- Keep each body under 120 words. No fake personalization.`;

/**
 * One personalized draft per sequence step. Uses OpenAI when available; otherwise
 * deterministic evidence-grounded templates. Drafts only — never sends.
 */
export async function draftSequenceEmails(
  lead: SequenceLeadInput,
  conference: SequenceConferenceInput,
  steps: SequenceStep[],
): Promise<SequenceDraft[]> {
  const groundedOn = evidenceLabels(lead);
  const templates = steps.map((step) => templateDraft(lead, conference, step));

  if (!isOpenAiEnabled()) return templates;

  const userPayload = {
    lead: {
      name: lead.name,
      title: lead.title ?? null,
      company: lead.company ?? null,
      session: lead.session ?? null,
      topics: lead.topics ?? [],
      evidence: (lead.evidence ?? []).map((e) => ({
        label: e.label,
        excerpt: e.excerpt,
        sourceUrl: e.sourceUrl,
      })),
    },
    conference,
    anchors: steps.map((s) => ({ anchor: s.anchor, label: s.label })),
  };

  const result = await chatJson(DRAFT_SYSTEM, JSON.stringify(userPayload));
  if (!result || typeof result !== "object") return templates;

  const draftsRaw = (result as { drafts?: unknown }).drafts;
  if (!Array.isArray(draftsRaw)) return templates;

  const byAnchor = new Map<string, { subject?: unknown; body?: unknown }>();
  for (const item of draftsRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { anchor?: unknown; subject?: unknown; body?: unknown };
    if (typeof row.anchor === "string") byAnchor.set(row.anchor, row);
  }

  return steps.map((step, index) => {
    const ai = byAnchor.get(step.anchor);
    const fallback = templates[index];
    if (
      ai &&
      typeof ai.subject === "string" &&
      ai.subject.trim() &&
      typeof ai.body === "string" &&
      ai.body.trim()
    ) {
      return {
        anchor: step.anchor,
        subject: ai.subject.trim(),
        body: ai.body.trim(),
        groundedOn,
        generatedBy: "openai" as const,
      };
    }
    return fallback;
  });
}

/** Merge draft subjects onto steps for UI/API response completeness. */
export function attachDraftSubjects(
  steps: SequenceStep[],
  drafts: SequenceDraft[],
): SequenceStep[] {
  const byAnchor = new Map(drafts.map((d) => [d.anchor, d]));
  return steps.map((step) => ({
    ...step,
    subject: byAnchor.get(step.anchor)?.subject ?? step.subject,
  }));
}
