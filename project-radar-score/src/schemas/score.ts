import { z } from "zod";

export const ProjectInputSchema = z.object({
  canonicalId: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  owners: z.array(z.string()),
  primaryOwner: z.string(),
  fuel: z.string(),
  mw: z.number(),
  county: z.string().optional(),
  zone: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  codYear: z.number().optional(),
  sources: z.array(
    z.object({
      source: z.enum(["ercot_gis", "puct", "tceq"]),
      sourceId: z.string(),
      recordId: z.string(),
      name: z.string(),
      milestone: z.string().optional(),
      evidence: z.string(),
    }),
  ),
  hardEr: z.boolean().optional(),
  clusterId: z.string().optional(),
});
export type ProjectInput = z.infer<typeof ProjectInputSchema>;

export const StageSchema = z.enum([
  "concept",
  "fel",
  "ia",
  "fid",
  "construction",
  "cod",
]);
export type Stage = z.infer<typeof StageSchema>;

export const ScoreRequestSchema = z.object({
  normalizeId: z.string().optional(),
  projects: z.array(ProjectInputSchema).min(1),
});
export type ScoreRequest = z.infer<typeof ScoreRequestSchema>;

export const ScoredProjectSchema = ProjectInputSchema.extend({
  stage: StageSchema,
  stageConfidence: z.number().min(0).max(1),
  stageEvidence: z.array(
    z.object({
      source: z.string(),
      sourceId: z.string(),
      milestone: z.string().optional(),
      note: z.string(),
    }),
  ),
  rankScore: z.number(),
  reason: z.string(),
  btmOrGasToPower: z.boolean(),
});
export type ScoredProject = z.infer<typeof ScoredProjectSchema>;

export const ScoreResultSchema = z.object({
  scoreId: z.string(),
  normalizeId: z.string().optional(),
  createdAt: z.string(),
  projectCount: z.number(),
  projects: z.array(ScoredProjectSchema),
});
export type ScoreResult = z.infer<typeof ScoreResultSchema>;

export const JoinPersonSchema = z.object({
  name: z.string(),
  title: z.string(),
  company: z.string(),
  conference: z.string().optional(),
  topic: z.string().optional(),
});

export const JoinResultSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  company: z.string(),
  people: z.array(JoinPersonSchema),
});
export type JoinResult = z.infer<typeof JoinResultSchema>;
