import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runQualification } from "../src/qualify/runQualification.js";

// Regenerate the committed sample qualified-output fixture from the sample
// ingestion input, using deterministic scoring so the output is stable.
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

const input = JSON.parse(
  readFileSync(join(fixturesDir, "sample-ingestion-input.json"), "utf-8"),
);

const result = await runQualification(input, { useOpenAi: false });
// Zero out the random ids so the committed fixture stays diff-stable.
const stable = {
  ...result,
  qualificationId: "00000000-0000-0000-0000-000000000000",
  leads: result.leads.map((l, i) => ({
    ...l,
    leadId: `lead-${String(i + 1).padStart(2, "0")}`,
  })),
};

writeFileSync(
  join(fixturesDir, "sample-qualified-output.json"),
  `${JSON.stringify(stable, null, 2)}\n`,
);
console.log(
  `Wrote sample-qualified-output.json: ${stable.leads.length} leads, ` +
    `${stable.totals.qualified} qualified.`,
);
