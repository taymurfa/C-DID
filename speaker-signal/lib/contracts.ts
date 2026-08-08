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

// --- Person 2 (qualification pipeline) output contract ---

export const PersonRoleSchema = z.enum([
  "speaker",
  "moderator",
  "sponsor",
  "staff",
  "exhibitor",
  "journalist",
  "unknown",
]);

/**
 * A ranked, qualified lead: a normalized, deduplicated speaker enriched with an
 * explainable ICP score, "why this person matters", and source evidence.
 * Extends the Speaker contract so the existing Signal Desk UI can render it.
 */
export const QualifiedLeadSchema = SpeakerSchema.extend({
  role: PersonRoleSchema,
  normalizedCompany: z.string().nullable(),
  topics: z.array(z.string()),
  isICP: z.boolean(),
  rank: z.number().int().positive(),
});

export const QualifyRequestSchema = z
  .object({
    // Provide EITHER a full Agent 1 ingestion payload...
    ingestion: z.unknown().optional(),
    // ...or a conference URL for Person 2 to fetch from Agent 1.
    conferenceUrl: z.url().optional(),
    agentUrl: z.url().optional(),
    maxPages: z.number().int().positive().max(40).optional(),
    demoMode: z.boolean().default(false),
    minTier: z.enum(["A", "B", "C", "D"]).default("C"),
  })
  .refine((v) => v.ingestion || v.conferenceUrl || v.demoMode, {
    message: "Provide `ingestion`, `conferenceUrl`, or set `demoMode`.",
  });

export const QualifyResponseSchema = z.object({
  mode: z.enum(["live", "demo"]),
  /** Which scorer produced the leads. */
  source: z.enum(["agent2", "embedded"]).optional(),
  /** True when live mode fell back to the embedded Person 2 pipeline. */
  degraded: z.boolean().optional(),
  conference: z.object({
    name: z.string().nullable(),
    websiteUrl: z.url(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    location: z.string().nullable(),
  }),
  stats: z.object({
    speakersIngested: z.number().int().nonnegative(),
    afterDedupe: z.number().int().nonnegative(),
    qualified: z.number().int().nonnegative(),
    companiesFound: z.number().int().nonnegative(),
    scoredWithOpenAI: z.boolean(),
  }),
  leads: z.array(QualifiedLeadSchema),
});

// --- Person 3 (outreach engine) contracts ---

/** Funnel progression (distinct from sequence-anchor `Speaker.outreachStage`). */
export const LeadStatusSchema = z.enum([
  "identified",
  "contacted",
  "replied",
  "meeting",
  "met",
  "follow-up",
  "booked",
]);

export const SequenceDraftSchema = z.object({
  anchor: z.enum(["T-14", "T-7", "T-2", "Event", "T+2"]),
  subject: z.string(),
  body: z.string(),
  groundedOn: z.array(z.string()),
  generatedBy: z.enum(["openai", "template"]),
});

export const SequenceConferenceSchema = z.object({
  name: z.string().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  websiteUrl: z.string().optional(),
});

/** Accept full QualifiedLead or a Speaker-shaped lead (seed / demo UI). */
export const SequenceLeadSchema = QualifiedLeadSchema.or(
  SpeakerSchema.extend({
    topics: z.array(z.string()).optional(),
  }),
);

export const SequenceRequestSchema = z.object({
  lead: SequenceLeadSchema,
  conference: SequenceConferenceSchema,
  now: z.iso.datetime().optional(),
});

export const SequenceResponseSchema = z.object({
  steps: z.array(SequenceStepSchema),
  drafts: z.array(SequenceDraftSchema),
});

export const FunnelStageSchema = z.object({
  stage: LeadStatusSchema,
  label: z.string(),
  count: z.number().int().nonnegative(),
  conversionFromPrior: z.number().nullable(),
});

export const FunnelSchema = z.object({
  stages: z.array(FunnelStageSchema),
  dropOff: z
    .object({
      from: LeadStatusSchema,
      to: LeadStatusSchema,
      fromLabel: z.string(),
      toLabel: z.string(),
      lost: z.number().int().nonnegative(),
    })
    .nullable(),
});

export type Speaker = z.infer<typeof SpeakerSchema>;
export type Conference = z.infer<typeof ConferenceSchema>;
export type SequenceStep = z.infer<typeof SequenceStepSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;
export type QualifiedLead = z.infer<typeof QualifiedLeadSchema>;
export type QualifyResponse = z.infer<typeof QualifyResponseSchema>;
export type LeadStatus = z.infer<typeof LeadStatusSchema>;
export type SequenceDraft = z.infer<typeof SequenceDraftSchema>;
export type SequenceConference = z.infer<typeof SequenceConferenceSchema>;
export type SequenceRequest = z.infer<typeof SequenceRequestSchema>;
export type SequenceResponse = z.infer<typeof SequenceResponseSchema>;
export type Funnel = z.infer<typeof FunnelSchema>;
export type FunnelStage = z.infer<typeof FunnelStageSchema>;
