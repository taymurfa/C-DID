import { z } from "zod";

export const RawSourceSchema = z.enum(["ercot_gis", "puct", "tceq"]);
export type RawSource = z.infer<typeof RawSourceSchema>;

export const RawRecordSchema = z.object({
  id: z.string(),
  source: RawSourceSchema,
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

export const IngestRequestSchema = z.object({
  mode: z.enum(["demo", "live"]).default("demo"),
  sourceIds: z.array(z.string()).optional(),
});
export type IngestRequest = z.infer<typeof IngestRequestSchema>;

export const IngestRunSchema = z.object({
  runId: z.string(),
  mode: z.enum(["demo", "live"]),
  createdAt: z.string(),
  recordCount: z.number(),
  sources: z.array(RawSourceSchema),
  records: z.array(RawRecordSchema),
  note: z.string().optional(),
});
export type IngestRun = z.infer<typeof IngestRunSchema>;
