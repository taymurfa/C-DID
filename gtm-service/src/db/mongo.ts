import { randomUUID } from "node:crypto";
import { MongoClient, type Collection } from "mongodb";
import { env } from "../config/env.js";
import { computeFunnel } from "../pipeline/funnel.js";
import type {
  Funnel,
  FunnelEvent,
  LeadStatus,
  SequenceRecord,
  SequenceStep,
} from "../schemas/gtm.js";
import {
  hydrateAgent3Sequence,
  isAgent3SequenceDoc,
  stagesFromAgent3Docs,
} from "./agent3Hydrate.js";

let client: MongoClient | null = null;
let db: import("mongodb").Db | null = null;

/** In-memory fallback when Atlas is not configured. */
const memorySequences = new Map<string, SequenceRecord>();
const memoryFunnelEvents: FunnelEvent[] = [];

export function isMongoConfigured(): boolean {
  return Boolean(env.mongoUri);
}

export function isMongoConnected(): boolean {
  return Boolean(db);
}

export async function connectMongo(): Promise<void> {
  if (!env.mongoUri || client) return;
  client = new MongoClient(env.mongoUri);
  await client.connect();
  db = client.db(env.mongoDb);
  await db
    .collection(env.mongoSequencesCollection)
    .createIndex({ id: 1 }, { unique: true })
    .catch(() => undefined);
  await db
    .collection(env.mongoFunnelEventsCollection)
    .createIndex({ eventId: 1 }, { unique: true })
    .catch(() => undefined);
  await db
    .collection(env.mongoFunnelEventsCollection)
    .createIndex({ leadId: 1, at: -1 })
    .catch(() => undefined);
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

function sequencesCollection(): Collection | null {
  if (!db) return null;
  return db.collection(env.mongoSequencesCollection);
}

function funnelCollection(): Collection | null {
  if (!db) return null;
  return db.collection(env.mongoFunnelEventsCollection);
}

export async function saveSequence(record: SequenceRecord): Promise<boolean> {
  memorySequences.set(record.id, record);
  const collection = sequencesCollection();
  if (!collection) return false;
  await collection
    .updateOne(
      { id: record.id },
      {
        $set: { ...record, updatedAt: record.updatedAt },
        $setOnInsert: { createdAt: record.createdAt },
      },
      { upsert: true },
    )
    .catch(() => undefined);
  return true;
}

async function normalizeSequenceDoc(
  doc: Record<string, unknown>,
): Promise<SequenceRecord | null> {
  if (isAgent3SequenceDoc(doc)) {
    if (!db) return null;
    return hydrateAgent3Sequence(db, doc);
  }
  // Dashboard-shaped docs already carry steps/drafts/lead.
  if (Array.isArray(doc.steps) && doc.leadId) {
    return {
      ...(doc as unknown as SequenceRecord),
      id: String(doc.id ?? doc._id ?? ""),
      leadId: String(doc.leadId),
    };
  }
  return null;
}

export async function listSequences(): Promise<SequenceRecord[]> {
  const collection = sequencesCollection();
  if (!collection) {
    return [...memorySequences.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }
  const docs = await collection
    .find({})
    .sort({ updated_at: -1, updatedAt: -1 })
    .limit(500)
    .toArray()
    .catch(() => []);

  const hydrated: SequenceRecord[] = [];
  for (const raw of docs) {
    const record = await normalizeSequenceDoc(raw as Record<string, unknown>);
    if (record?.leadId && record.steps?.length) hydrated.push(record);
  }
  return hydrated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getSequence(id: string): Promise<SequenceRecord | null> {
  const collection = sequencesCollection();
  if (!collection) return memorySequences.get(id) ?? null;

  const byDashboardId = await collection.findOne({ id }).catch(() => null);
  if (byDashboardId) {
    const normalized = await normalizeSequenceDoc(
      byDashboardId as Record<string, unknown>,
    );
    if (normalized) return normalized;
  }

  // Agent 3 sequences are keyed by Mongo _id / speaker_id.
  const { ObjectId } = await import("mongodb");
  if (ObjectId.isValid(id)) {
    const byOid = await collection
      .findOne({ _id: new ObjectId(id) })
      .catch(() => null);
    if (byOid) {
      const normalized = await normalizeSequenceDoc(
        byOid as Record<string, unknown>,
      );
      if (normalized) return normalized;
    }
  }

  const bySpeaker = await collection.findOne({ speaker_id: id }).catch(() => null);
  if (bySpeaker) {
    const normalized = await normalizeSequenceDoc(
      bySpeaker as Record<string, unknown>,
    );
    if (normalized) return normalized;
  }

  return memorySequences.get(id) ?? null;
}

export async function getSequenceByLeadId(
  leadId: string,
): Promise<SequenceRecord | null> {
  const collection = sequencesCollection();
  if (!collection) {
    return (
      [...memorySequences.values()].find((s) => s.leadId === leadId) ?? null
    );
  }
  const doc =
    (await collection.findOne({ leadId }).catch(() => null)) ||
    (await collection.findOne({ speaker_id: leadId }).catch(() => null));
  if (!doc) return null;
  return normalizeSequenceDoc(doc as Record<string, unknown>);
}

export async function patchSequenceStep(
  sequenceId: string,
  stepId: string,
  patch: { status?: SequenceStep["status"]; subject?: string | null },
): Promise<SequenceRecord | null> {
  const existing = await getSequence(sequenceId);
  if (!existing) return null;

  const steps = existing.steps.map((step) =>
    step.id === stepId
      ? {
          ...step,
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
        }
      : step,
  );
  if (!steps.some((s) => s.id === stepId)) return null;

  const updated: SequenceRecord = {
    ...existing,
    steps,
    updatedAt: new Date().toISOString(),
  };
  await saveSequence(updated);
  return updated;
}

export async function appendFunnelEvent(input: {
  leadId: string;
  status: LeadStatus;
  at?: string;
  conferenceName?: string | null;
}): Promise<FunnelEvent> {
  const event: FunnelEvent = {
    eventId: randomUUID(),
    leadId: input.leadId,
    status: input.status,
    at: input.at ?? new Date().toISOString(),
    conferenceName: input.conferenceName ?? null,
  };
  memoryFunnelEvents.push(event);

  const collection = funnelCollection();
  if (collection) {
    await collection.insertOne({ ...event }).catch(() => undefined);
  }
  return event;
}

function latestStatusesFromEvents(events: FunnelEvent[]): Record<string, LeadStatus> {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const map: Record<string, LeadStatus> = {};
  for (const event of sorted) map[event.leadId] = event.status;
  return map;
}

export async function getFunnel(): Promise<Funnel> {
  const collection = funnelCollection();
  let events: FunnelEvent[] = memoryFunnelEvents;
  if (collection) {
    const docs = await collection
      .find({})
      .sort({ at: 1 })
      .limit(5000)
      .toArray()
      .catch(() => []);
    if (docs.length > 0) {
      events = docs.map((d) => d as unknown as FunnelEvent);
    }
  }

  const leadStatuses = latestStatusesFromEvents(events);

  // When funnel_events is empty (Agent 3 import path), roll up from sequences.stage.
  if (Object.keys(leadStatuses).length === 0 && sequencesCollection() && db) {
    const seqDocs = await sequencesCollection()!
      .find({})
      .limit(500)
      .toArray()
      .catch(() => []);
    Object.assign(leadStatuses, stagesFromAgent3Docs(seqDocs as Record<string, unknown>[]));
    for (const raw of seqDocs) {
      const doc = raw as Record<string, unknown>;
      if (isAgent3SequenceDoc(doc)) continue;
      const leadId = String(doc.leadId ?? "");
      if (leadId && !leadStatuses[leadId]) leadStatuses[leadId] = "identified";
    }
  }

  const funnel = computeFunnel(
    Object.values(leadStatuses).map((status) => ({ status })),
  );
  return { ...funnel, leadStatuses };
}
