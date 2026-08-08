import { MongoClient } from "mongodb";
import { env } from "../src/config/env.js";

/**
 * Small operational helper: print a summary of the most recent qualification
 * runs stored in MongoDB. Usage: `npm run leads:list`
 */
async function main() {
  if (!env.mongoUri) {
    console.error("MONGODB_URI is not set; nothing to list.");
    process.exit(1);
  }

  const client = new MongoClient(env.mongoUri);
  await client.connect();
  try {
    const collection = client
      .db(env.mongoDb)
      .collection(env.mongoQualificationsCollection);
    const total = await collection.countDocuments();
    const runs = await collection
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    console.log(
      `DB "${env.mongoDb}" collection "${env.mongoQualificationsCollection}": ${total} run(s) total\n`,
    );
    for (const run of runs) {
      const topLead = run.leads?.[0];
      console.log(
        [
          `qualificationId: ${run.qualificationId}`,
          `conference:      ${run.conferenceName ?? "(unknown)"}`,
          `speakersIn:      ${run.totals?.speakersIn ?? 0}`,
          `afterDedup:      ${run.totals?.afterDedup ?? 0}`,
          `qualified:       ${run.totals?.qualified ?? 0}`,
          `icpEnrichment:   ${run.icpEnrichment}`,
          `topLead:         ${topLead ? `${topLead.name} (${topLead.scores?.total})` : "(none)"}`,
          `createdAt:       ${run.createdAt?.toISOString?.() ?? run.createdAt}`,
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
