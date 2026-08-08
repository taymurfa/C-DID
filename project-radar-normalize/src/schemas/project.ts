import { z } from "zod";

export const RawRecordSchema = z.object({
  id: z.string(),
  source: z.enum(["ercot_gis", "puct", "tceq"]),
  sourceId: z.string(),
  name: z.string(),
  owner: z.string(),
  fuel: z.string(),
  mw: z.number(),
  county: z.string().optional(),
  zone: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  codYear: z.number().optional(),
  queueStatus: z.string().optional(),
  milestone: z.string().optional(),
  clusterId: z.string().optional(),
  evidence: z.string(),
});
export type RawRecord = z.infer<typeof RawRecordSchema>;

export const NormalizeRequestSchema = z.object({
  runId: z.string().optional(),
  records: z.array(RawRecordSchema).min(1),
});
export type NormalizeRequest = z.infer<typeof NormalizeRequestSchema>;

export const CanonicalProjectSchema = z.object({
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
  hardEr: z.boolean().default(false),
  clusterId: z.string().optional(),
});
export type CanonicalProject = z.infer<typeof CanonicalProjectSchema>;

export const NormalizeResultSchema = z.object({
  normalizeId: z.string(),
  runId: z.string().optional(),
  createdAt: z.string(),
  inputCount: z.number(),
  projectCount: z.number(),
  projects: z.array(CanonicalProjectSchema),
});
export type NormalizeResult = z.infer<typeof NormalizeResultSchema>;
