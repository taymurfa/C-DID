import { randomUUID } from "node:crypto";
import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "../config/env.js";
import { computeFunnel } from "../pipeline/funnel.js";
import type {
  Funnel,
  FunnelEvent,
  LeadStatus,
  SequenceRecord,
  SequenceStep,
} from "../schemas/gtm.js";

let client: MongoClient | null = null;
let db: Db | null = null;

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

export async function listSequences(): Promise<SequenceRecord[]> {
  const collection = sequencesCollection();
  if (!collection) {
    return [...memorySequences.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }
  const docs = await collection
    .find({})
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray()
    .catch(() => []);
  return docs.map((d) => d as unknown as SequenceRecord);
}

export async function getSequence(id: string): Promise<SequenceRecord | null> {
  const collection = sequencesCollection();
  if (!collection) return memorySequences.get(id) ?? null;
  const doc = await collection.findOne({ id }).catch(() => null);
  if (!doc) return memorySequences.get(id) ?? null;
  return doc as unknown as SequenceRecord;
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
  const funnel = computeFunnel(
    Object.values(leadStatuses).map((status) => ({ status })),
  );
  return { ...funnel, leadStatuses };
}
