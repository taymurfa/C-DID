import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "../config/env.js";
import type { IngestRun } from "../schemas/raw.js";

let client: MongoClient | null = null;
let db: Db | null = null;

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
    .collection(env.mongoRunsCollection)
    .createIndex({ runId: 1 }, { unique: true })
    .catch(() => undefined);
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

function runsCollection(): Collection | null {
  if (!db) return null;
  return db.collection(env.mongoRunsCollection);
}

const memoryRuns = new Map<string, IngestRun>();

export async function saveRun(run: IngestRun): Promise<boolean> {
  memoryRuns.set(run.runId, run);
  const collection = runsCollection();
  if (!collection) return false;
  await collection
    .updateOne(
      { runId: run.runId },
      {
        $set: { ...run, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    )
    .catch(() => undefined);
  return true;
}

export async function getRun(runId: string): Promise<IngestRun | null> {
  if (memoryRuns.has(runId)) return memoryRuns.get(runId) ?? null;
  const collection = runsCollection();
  if (!collection) return null;
  const doc = await collection.findOne({ runId }).catch(() => null);
  if (!doc) return null;
  const { _id: _ignored, ...rest } = doc as IngestRun & { _id?: unknown };
  return rest as IngestRun;
}
