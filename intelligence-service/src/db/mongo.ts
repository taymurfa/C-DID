import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "../config/env.js";
import type { QualificationResult } from "../schemas/lead.js";

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
    .collection(env.mongoQualificationsCollection)
    .createIndex({ qualificationId: 1 }, { unique: true })
    .catch(() => undefined);
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

function qualificationsCollection(): Collection | null {
  if (!db) return null;
  return db.collection(env.mongoQualificationsCollection);
}

/**
 * Persist a completed qualification run. No-ops (and never throws) when MongoDB
 * is not configured so the service stays independently runnable.
 */
export async function saveQualification(
  result: QualificationResult,
): Promise<boolean> {
  const collection = qualificationsCollection();
  if (!collection) return false;

  await collection
    .updateOne(
      { qualificationId: result.qualificationId },
      {
        $set: { ...result, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    )
    .catch(() => undefined);
  return true;
}
