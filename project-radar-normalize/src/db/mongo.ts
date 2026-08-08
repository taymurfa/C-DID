import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "../config/env.js";
import type { NormalizeResult } from "../schemas/project.js";

let client: MongoClient | null = null;
let db: Db | null = null;
let latest: NormalizeResult | null = null;

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
    .collection(env.mongoProjectsCollection)
    .createIndex({ normalizeId: 1 }, { unique: true })
    .catch(() => undefined);
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

function projectsCollection(): Collection | null {
  if (!db) return null;
  return db.collection(env.mongoProjectsCollection);
}

export async function saveNormalizeResult(
  result: NormalizeResult,
): Promise<boolean> {
  latest = result;
  const collection = projectsCollection();
  if (!collection) return false;
  await collection
    .updateOne(
      { normalizeId: result.normalizeId },
      {
        $set: { ...result, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    )
    .catch(() => undefined);
  return true;
}

export function getLatestNormalizeResult(): NormalizeResult | null {
  return latest;
}
