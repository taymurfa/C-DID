import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "../config/env.js";
import type { ScoreResult } from "../schemas/score.js";

let client: MongoClient | null = null;
let db: Db | null = null;
let latest: ScoreResult | null = null;

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
    .collection(env.mongoScoresCollection)
    .createIndex({ scoreId: 1 }, { unique: true })
    .catch(() => undefined);
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

function scoresCollection(): Collection | null {
  if (!db) return null;
  return db.collection(env.mongoScoresCollection);
}

export async function saveScoreResult(result: ScoreResult): Promise<boolean> {
  latest = result;
  const collection = scoresCollection();
  if (!collection) return false;
  await collection
    .updateOne(
      { scoreId: result.scoreId },
      {
        $set: { ...result, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    )
    .catch(() => undefined);
  return true;
}

export function getLatestScoreResult(): ScoreResult | null {
  return latest;
}
