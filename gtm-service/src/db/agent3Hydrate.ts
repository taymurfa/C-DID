/**
 * Hydrate Python Agent 3 Mongo docs (events + emails + slim sequences)
 * into the dashboard SequenceRecord shape the desk expects.
 */
import { ObjectId, type Db } from "mongodb";
import type {
  LeadStatus,
  SequenceConference,
  SequenceDraft,
  SequenceLead,
  SequenceRecord,
  SequenceStep,
} from "../schemas/gtm.js";

const KIND_TO_ANCHOR: Record<string, SequenceStep["anchor"]> = {
  t_minus_14: "T-14",
  t_minus_7: "T-7",
  t_minus_2: "T-2",
  event_day: "Event",
  post_event: "T+2",
};

const STAGE_TO_DASHBOARD: Record<string, LeadStatus> = {
  identified: "identified",
  contacted: "contacted",
  replied: "replied",
  meeting: "meeting",
  met: "met",
  follow_up: "follow-up",
  conversation_booked: "booked",
};

export function isAgent3SequenceDoc(doc: Record<string, unknown>): boolean {
  return Boolean(doc.speaker_id) && !Array.isArray(doc.steps);
}

function iso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return value;
  }
  return null;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function stepStatus(
  email: Record<string, unknown>,
  now: Date,
): SequenceStep["status"] {
  const status = String(email.status ?? "draft").toLowerCase();
  if (status === "sent" || status === "opened") return "Sent";
  if (status === "replied" || status === "meeting") return "Opportunity";
  const sendAt = asDate(email.send_at);
  if (!sendAt) return "Planned";
  return sendAt.getTime() <= now.getTime() ? "Scheduled" : "Planned";
}

function groundedOn(
  speaker: Record<string, unknown>,
  event: Record<string, unknown>,
): string[] {
  const bits: string[] = [];
  for (const key of ["talk_title", "talk_topic", "company", "title", "icp_reason"]) {
    const val = speaker[key];
    if (val) bits.push(String(val));
  }
  for (const key of ["name", "location", "venue", "conference"]) {
    const val = event[key];
    if (val) bits.push(String(val));
  }
  return bits.slice(0, 6);
}

function leadFromSpeaker(
  speaker: Record<string, unknown>,
  event: Record<string, unknown>,
): SequenceLead {
  const score = Number(speaker.icp_score ?? 0);
  const talk = (speaker.talk_title || speaker.talk_topic || event.name || null) as
    | string
    | null;
  const evidenceRaw = Array.isArray(speaker.evidence) ? speaker.evidence : [];
  const sourceUrl =
    (typeof event.url === "string" && event.url) ||
    "https://www.datacenterworld.com/";

  return {
    id: String(speaker.id ?? ""),
    name: String(speaker.name ?? "Speaker"),
    title: (speaker.title as string | null | undefined) ?? null,
    company: (speaker.company as string | null | undefined) ?? null,
    conference: String(event.conference || event.name || "Conference"),
    session: talk,
    topics: talk ? [talk] : [],
    email: (speaker.email as string | null | undefined) ?? null,
    score,
    reason: (speaker.icp_reason as string | undefined) ?? undefined,
    whyThisPersonMatters: (speaker.icp_reason as string | undefined) ?? undefined,
    evidence: evidenceRaw.map((item, index) => {
      const excerpt = typeof item === "string" ? item : String(item ?? "");
      return {
        label: index === 0 ? "Session" : "Signal",
        excerpt,
        sourceUrl,
        confidence: 0.85,
      };
    }),
  };
}

function conferenceFromEvent(event: Record<string, unknown>): SequenceConference {
  const start =
    iso(event.start_date) ||
    iso(event.startDate) ||
    new Date().toISOString();
  const end = iso(event.end_date) || iso(event.endDate) || start;
  return {
    name: String(event.conference || event.name || "Conference"),
    startDate: start,
    endDate: end,
    location:
      (event.location as string | null | undefined) ||
      (event.venue as string | null | undefined) ||
      null,
    websiteUrl:
      (typeof event.url === "string" && event.url) ||
      "https://www.datacenterworld.com/",
  };
}

export function dashboardStageFromAgent3(stage: unknown): LeadStatus {
  const key = String(stage ?? "identified");
  return STAGE_TO_DASHBOARD[key] ?? "identified";
}

export async function hydrateAgent3Sequence(
  db: Db,
  doc: Record<string, unknown>,
  now: Date = new Date(),
): Promise<SequenceRecord | null> {
  const speakerId = String(doc.speaker_id ?? "");
  if (!speakerId) return null;

  const seqOid =
    doc._id instanceof ObjectId
      ? doc._id
      : typeof doc._id === "string"
        ? ObjectId.createFromHexString(doc._id)
        : null;
  if (!seqOid) return null;

  const emails = await db
    .collection("emails")
    .find({ sequence_id: seqOid })
    .sort({ sort_order: 1 })
    .toArray();

  let event: Record<string, unknown> | null = null;
  if (doc.event_id) {
    const eventOid =
      doc.event_id instanceof ObjectId
        ? doc.event_id
        : typeof doc.event_id === "string" && ObjectId.isValid(doc.event_id)
          ? ObjectId.createFromHexString(doc.event_id)
          : null;
    if (eventOid) {
      event = (await db.collection("events").findOne({ _id: eventOid })) as
        | Record<string, unknown>
        | null;
    }
  }
  if (!event) {
    event = (await db.collection("events").findOne({
      "speakers.id": speakerId,
    })) as Record<string, unknown> | null;
  }

  const speakers = Array.isArray(event?.speakers) ? event!.speakers : [];
  const speaker =
    (speakers.find(
      (sp: Record<string, unknown>) => String(sp?.id) === speakerId,
    ) as Record<string, unknown> | undefined) ?? {};

  const eventDoc = event ?? {};
  const lead = leadFromSpeaker(speaker, eventDoc);
  const conference = conferenceFromEvent(eventDoc);

  const steps: SequenceStep[] = [];
  const drafts: SequenceDraft[] = [];
  for (const raw of emails) {
    const em = raw as Record<string, unknown>;
    const kind = String(em.kind ?? "");
    const anchor = KIND_TO_ANCHOR[kind] ?? "T-14";
    const scheduledFor = iso(em.send_at) || conference.startDate;
    steps.push({
      id: String(em._id ?? `${speakerId}-${kind}`),
      anchor,
      label: String(em.label ?? anchor),
      scheduledFor,
      subject: (em.subject as string | null | undefined) ?? null,
      status: stepStatus(em, now),
    });
    drafts.push({
      anchor,
      subject: String(em.subject ?? ""),
      body: String(em.body ?? ""),
      groundedOn: groundedOn(speaker, eventDoc),
      generatedBy: em.generated_by === "llm" ? "openai" : "template",
    });
  }

  return {
    id: String(doc._id),
    leadId: speakerId,
    lead,
    conference,
    steps,
    drafts,
    createdAt: iso(doc.created_at) || now.toISOString(),
    updatedAt: iso(doc.updated_at) || now.toISOString(),
  };
}

export function stagesFromAgent3Docs(
  docs: Record<string, unknown>[],
): Record<string, LeadStatus> {
  const out: Record<string, LeadStatus> = {};
  for (const doc of docs) {
    if (!isAgent3SequenceDoc(doc)) continue;
    const leadId = String(doc.speaker_id ?? "");
    if (!leadId) continue;
    out[leadId] = dashboardStageFromAgent3(doc.stage);
  }
  return out;
}
