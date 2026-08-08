import { MongoClient } from "mongodb";
import { env } from "../src/config/env.js";

/**
 * Small operational helper: print a summary of the most recent ingestion runs
 * stored in MongoDB. Usage: `npm run runs:list`
 */
async function main() {
  if (!env.mongoUri) {
    console.error("MONGODB_URI is not set; nothing to list.");
    process.exit(1);
  }

  const client = new MongoClient(env.mongoUri);
  await client.connect();
  try {
    const collection = client.db(env.mongoDb).collection(env.mongoRunsCollection);
    const total = await collection.countDocuments();
    const runs = await collection
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    console.log(
      `DB "${env.mongoDb}" collection "${env.mongoRunsCollection}": ${total} run(s) total\n`,
    );
    for (const run of runs) {
      console.log(
        [
          `runId:      ${run.runId}`,
          `conference: ${run.conference?.name ?? "(unknown)"}`,
          `website:    ${run.conference?.websiteUrl}`,
          `pages:      ${run.pages?.length ?? 0}`,
          `sessions:   ${run.sessions?.length ?? 0}`,
          `speakers:   ${run.speakers?.length ?? 0}`,
          `errors:     ${run.errors?.length ?? 0}`,
          `createdAt:  ${run.createdAt?.toISOString?.() ?? run.createdAt}`,
          "----------------------------------------",
        ].join("\n"),
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
