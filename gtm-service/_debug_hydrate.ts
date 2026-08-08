import { MongoClient } from "mongodb";
import { config as loadDotenv } from "dotenv";
import { resolve } from "path";
import { hydrateAgent3Sequence, isAgent3SequenceDoc } from "./src/db/agent3Hydrate.ts";

loadDotenv({ path: resolve("..", ".env") });

const client = new MongoClient(process.env.MONGODB_URI!);
await client.connect();
const db = client.db("speaker_signal_gtm");
const seq = await db.collection("sequences").findOne({});
console.log("isAgent3", isAgent3SequenceDoc(seq as Record<string, unknown>));
console.log("seq", JSON.stringify(seq, null, 2).slice(0, 400));
const hydrated = await hydrateAgent3Sequence(db, seq as Record<string, unknown>);
console.log("hydrated lead", hydrated?.lead?.name);
console.log("hydrated steps", hydrated?.steps?.length);
console.log("hydrated draft0", hydrated?.drafts?.[0]?.subject?.slice(0, 80));
await client.close();
