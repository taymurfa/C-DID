import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "../config/env.js";
import type { IngestionResult } from "../schemas/ingestion.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export function isMongoConfigured(): boolean {
  return Boolean(env.mongoUri);
}

/**
 * Connect to MongoDB Atlas if configured. Safe to call once at boot; a missing
 * MONGODB_URI is not an error (the service simply skips persistence).
 */
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

/**
 * Fetch the most recent previously-stored run for a given conference website,
 * used for freshness/change detection. Returns null when unavailable.
 */
export async function getPreviousRun(
  websiteUrl: string,
): Promise<IngestionResult | null> {
  const collection = runsCollection();
  if (!collection) return null;
  const doc = await collection
    .find({ "conference.websiteUrl": websiteUrl })
    .sort({ createdAt: -1 })
    .limit(1)
    .next()
    .catch(() => null);
  return (doc as IngestionResult | null) ?? null;
}

/**
 * Persist a completed ingestion run. No-ops (and never throws) when MongoDB is
 * not configured so the service stays independently runnable.
 */
export async function saveRun(result: IngestionResult): Promise<boolean> {
  const collection = runsCollection();
  if (!collection) return false;

  await collection.updateOne(
    { runId: result.runId },
    { $set: { ...result, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
  return true;
}
