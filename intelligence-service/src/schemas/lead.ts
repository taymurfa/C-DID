import { z } from "zod";
import { PersonRoleSchema } from "./ingestionInput.js";

export const SeniorityLevelSchema = z.enum([
  "c_level",
  "vp",
  "director",
  "manager",
  "practitioner",
  "unknown",
]);

export type SeniorityLevel = z.infer<typeof SeniorityLevelSchema>;

export const LeadTierSchema = z.enum(["A", "B", "C", "D"]);
export type LeadTier = z.infer<typeof LeadTierSchema>;

/**
 * The six weighted signals behind a lead's score. Each is normalized to 0..1;
 * `total` is the weighted blend rescaled to 0..100 for easy reading/sorting.
 */
export const LeadScoresSchema = z.object({
  total: z.number().min(0).max(100),
  roleFit: z.number().min(0).max(1),
  companyIcpFit: z.number().min(0).max(1),
  seniority: z.number().min(0).max(1),
  topicRelevance: z.number().min(0).max(1),
  buyingInfluence: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

export type LeadScores = z.infer<typeof LeadScoresSchema>;

export const QualifiedLeadSchema = z.object({
  leadId: z.string(),
  // Normalized, display-ready values.
  name: z.string(),
  originalName: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  companyKey: z.string().nullable(),
  role: PersonRoleSchema,
  seniority: SeniorityLevelSchema,
  topics: z.array(z.string()),
  sessionTitles: z.array(z.string()),
  sourceUrls: z.array(z.string()),
  scores: LeadScoresSchema,
  tier: LeadTierSchema,
  qualified: z.boolean(),
  whyThisPersonMatters: z.string(),
  evidence: z.array(z.string()),
  // Whether the ICP-fit signal came from OpenAI or the deterministic fallback.
  icpSource: z.enum(["openai", "deterministic"]),
  // sourceIds of the raw speaker records that were merged into this lead.
  mergedSourceIds: z.array(z.string()),
});

export type QualifiedLead = z.infer<typeof QualifiedLeadSchema>;

export const CompanyAggregateSchema = z.object({
  companyKey: z.string(),
  displayName: z.string(),
  leadCount: z.number().int().nonnegative(),
  icpFit: z.number().min(0).max(1),
  topLeadName: z.string().nullable(),
});

export type CompanyAggregate = z.infer<typeof CompanyAggregateSchema>;

export const QualifyRequestSchema = z.object({
  // Accept either a full ingestion payload wrapped in `ingestion`, or the bare
  // fields at the top level. The route normalizes both into IngestionInput.
  ingestion: z.unknown().optional(),
  runId: z.string().optional(),
  conference: z.unknown().optional(),
  sessions: z.unknown().optional(),
  speakers: z.unknown().optional(),
  // Optional per-request override of the qualification threshold (0-100).
  minScore: z.number().min(0).max(100).optional(),
  // Set false to skip OpenAI even when configured (pure deterministic run).
  useOpenAi: z.boolean().optional(),
});

export type QualifyRequest = z.infer<typeof QualifyRequestSchema>;

export const QualificationErrorSchema = z.object({
  stage: z.enum(["parse", "normalize", "dedupe", "score", "explain"]),
  message: z.string(),
});

export type QualificationError = z.infer<typeof QualificationErrorSchema>;

export const QualificationResultSchema = z.object({
  qualificationId: z.string(),
  sourceRunId: z.string().nullable(),
  conferenceName: z.string().nullable(),
  totals: z.object({
    speakersIn: z.number().int().nonnegative(),
    afterDedup: z.number().int().nonnegative(),
    eligible: z.number().int().nonnegative(),
    qualified: z.number().int().nonnegative(),
    companies: z.number().int().nonnegative(),
  }),
  icpEnrichment: z.enum(["openai", "deterministic"]),
  leads: z.array(QualifiedLeadSchema),
  companies: z.array(CompanyAggregateSchema),
  errors: z.array(QualificationErrorSchema),
});

export type QualificationResult = z.infer<typeof QualificationResultSchema>;
