import { v4 as uuid } from "uuid";
import type {
  ProjectInput,
  ScoreRequest,
  ScoreResult,
  ScoredProject,
  Stage,
} from "../schemas/score.js";

const MILESTONE_STAGE: Record<string, { stage: Stage; confidence: number }> = {
  energized: { stage: "cod", confidence: 0.95 },
  under_construction: { stage: "construction", confidence: 0.9 },
  financial_security_posted: { stage: "fid", confidence: 0.8 },
  synchronized: { stage: "construction", confidence: 0.85 },
  ia_signed_studies_done: { stage: "ia", confidence: 0.85 },
  full_interconnection_study: { stage: "fel", confidence: 0.7 },
  screening_study: { stage: "concept", confidence: 0.55 },
  ccn_application: { stage: "fel", confidence: 0.65 },
  market_registration: { stage: "concept", confidence: 0.5 },
  special_contract: { stage: "fel", confidence: 0.6 },
  transmission_study: { stage: "fel", confidence: 0.6 },
  air_permit_issued: { stage: "fid", confidence: 0.75 },
  air_permit_pending: { stage: "fel", confidence: 0.6 },
};

const STAGE_RANK: Record<Stage, number> = {
  concept: 1,
  fel: 2,
  ia: 3,
  fid: 4,
  construction: 5,
  cod: 6,
};

function inferStage(project: ProjectInput): {
  stage: Stage;
  confidence: number;
  evidence: ScoredProject["stageEvidence"];
} {
  const evidence: ScoredProject["stageEvidence"] = [];
  let best: { stage: Stage; confidence: number } = {
    stage: "concept",
    confidence: 0.4,
  };

  for (const src of project.sources) {
    const milestone = src.milestone ?? "";
    const mapped = MILESTONE_STAGE[milestone];
    if (mapped) {
      evidence.push({
        source: src.source,
        sourceId: src.sourceId,
        milestone,
        note: src.evidence,
      });
      if (
        STAGE_RANK[mapped.stage] > STAGE_RANK[best.stage] ||
        (mapped.stage === best.stage && mapped.confidence > best.confidence)
      ) {
        best = mapped;
      }
    } else {
      evidence.push({
        source: src.source,
        sourceId: src.sourceId,
        milestone: milestone || undefined,
        note: src.evidence,
      });
    }
  }

  // Multi-source bonus: bump confidence when ≥2 independent sources agree-ish
  if (project.sources.length >= 2) {
    best = {
      ...best,
      confidence: Math.min(0.98, best.confidence + 0.08),
    };
  }
  if (project.sources.length >= 3) {
    best = {
      ...best,
      confidence: Math.min(0.98, best.confidence + 0.05),
    };
  }

  return { stage: best.stage, confidence: best.confidence, evidence };
}

function isBtmOrGas(project: ProjectInput): boolean {
  const blob = `${project.name} ${project.aliases.join(" ")} ${project.fuel} ${project.clusterId ?? ""}`.toLowerCase();
  return (
    blob.includes("btm") ||
    blob.includes("behind") ||
    blob.includes("data") ||
    blob.includes("campus") ||
    (project.fuel === "gas" && (blob.includes("peaker") || blob.includes("campus")))
  );
}

function rankScore(
  project: ProjectInput,
  stage: Stage,
  confidence: number,
  btm: boolean,
): number {
  let score = STAGE_RANK[stage] * 12 + confidence * 30 + Math.min(project.mw / 20, 25);
  if (btm) score += 15;
  if (project.hardEr) score += 10;
  if (project.sources.length >= 3) score += 8;
  else if (project.sources.length >= 2) score += 4;
  return Math.round(score * 10) / 10;
}

function reason(
  project: ProjectInput,
  stage: Stage,
  confidence: number,
  btm: boolean,
): string {
  const srcList = project.sources.map((s) => s.source).join(" + ");
  const er = project.hardEr
    ? ` Hard ER: ${project.aliases.length} aliases across sources.`
    : "";
  const lens = btm ? " Matches early gas-to-power / BTM data-center lens." : "";
  return `${project.name} inferred at ${stage} (${Math.round(confidence * 100)}% confidence) from ${srcList}.${er}${lens}`;
}

export function runScore(req: ScoreRequest): ScoreResult {
  const projects: ScoredProject[] = req.projects.map((project) => {
    const { stage, confidence, evidence } = inferStage(project);
    const btmOrGasToPower = isBtmOrGas(project);
    return {
      ...project,
      hardEr: Boolean(project.hardEr),
      stage,
      stageConfidence: confidence,
      stageEvidence: evidence,
      rankScore: rankScore(project, stage, confidence, btmOrGasToPower),
      reason: reason(project, stage, confidence, btmOrGasToPower),
      btmOrGasToPower,
    };
  });

  projects.sort((a, b) => b.rankScore - a.rankScore);

  return {
    scoreId: uuid(),
    normalizeId: req.normalizeId,
    createdAt: new Date().toISOString(),
    projectCount: projects.length,
    projects,
  };
}
