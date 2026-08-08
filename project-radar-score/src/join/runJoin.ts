import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { JoinResult, ScoredProject } from "../schemas/score.js";

type JoinFixture = {
  companyKeys: string[];
  people: JoinResult["people"];
};

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/people-join.json",
);

function loadFixtures(): JoinFixture[] {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as JoinFixture[];
}

function blobFor(project: ScoredProject): string {
  return [
    project.name,
    project.primaryOwner,
    ...project.owners,
    ...project.aliases,
  ]
    .join(" ")
    .toLowerCase();
}

export function runJoin(projects: ScoredProject[]): JoinResult[] {
  const fixtures = loadFixtures();
  const out: JoinResult[] = [];

  for (const project of projects) {
    const blob = blobFor(project);
    for (const fixture of fixtures) {
      if (fixture.companyKeys.some((k) => blob.includes(k))) {
        out.push({
          projectId: project.canonicalId,
          projectName: project.name,
          company: fixture.people[0]?.company ?? project.primaryOwner,
          people: fixture.people,
        });
        break;
      }
    }
  }

  return out;
}
