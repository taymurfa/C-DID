import { z } from "zod";

export const EvidenceSchema = z.object({
  label: z.string(),
  excerpt: z.string(),
  sourceUrl: z.url(),
  confidence: z.number().min(0).max(1),
});

export const ScoreBreakdownSchema = z.object({
  roleFit: z.number().min(0).max(20),
  companyFit: z.number().min(0).max(20),
  topicRelevance: z.number().min(0).max(25),
  seniority: z.number().min(0).max(15),
  buyingInfluence: z.number().min(0).max(10),
  eventProximity: z.number().min(0).max(10),
});

export const SpeakerSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  conference: z.string(),
  session: z.string().nullable(),
  score: z.number().min(0).max(100),
  tier: z.enum(["A", "B", "C", "D"]),
  scoreReason: z.string(),
  confidence: z.number().min(0).max(1),
  scoreBreakdown: ScoreBreakdownSchema,
  evidence: z.array(EvidenceSchema),
  outreachStage: z.enum(["Identified", "T-14", "T-7", "T-2", "Event", "Post-event"]),
});

export const ConferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
  city: z.string(),
  sourceUrl: z.url(),
  speakerCount: z.number().int().nonnegative(),
  qualifiedCount: z.number().int().nonnegative(),
  status: z.enum(["Analyzed", "Processing", "Queued"]),
});

export const SequenceStepSchema = z.object({
  id: z.string(),
  anchor: z.enum(["T-14", "T-7", "T-2", "Event", "T+2"]),
  label: z.string(),
  scheduledFor: z.iso.datetime(),
  subject: z.string().nullable(),
  status: z.enum(["Sent", "Scheduled", "Planned", "Opportunity"]),
});

export const AnalyzeRequestSchema = z.object({
  url: z.url(),
  demoMode: z.boolean().default(true),
});

export const AnalyzeResponseSchema = z.object({
  sourceUrl: z.url(),
  mode: z.enum(["live", "demo"]),
  pageTitle: z.string(),
  message: z.string(),
  pagesProcessed: z.number().int().positive(),
  entitiesExtracted: z.number().int().nonnegative(),
  speaker: SpeakerSchema,
});

export type Speaker = z.infer<typeof SpeakerSchema>;
export type Conference = z.infer<typeof ConferenceSchema>;
export type SequenceStep = z.infer<typeof SequenceStepSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
