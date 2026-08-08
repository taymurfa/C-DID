import { z } from "zod";

export const LeadStatusSchema = z.enum([
  "identified",
  "contacted",
  "replied",
  "meeting",
  "met",
  "follow-up",
  "booked",
]);

export const SequenceStepSchema = z.object({
  id: z.string(),
  anchor: z.enum(["T-14", "T-7", "T-2", "Event", "T+2"]),
  label: z.string(),
  scheduledFor: z.string(),
  subject: z.string().nullable(),
  status: z.enum(["Sent", "Scheduled", "Planned", "Opportunity"]),
});

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

/** Lenient lead shape — accepts dashboard Speaker / QualifiedLead fields. */
export const SequenceLeadSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    title: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    conference: z.string().optional(),
    session: z.string().nullable().optional(),
    topics: z.array(z.string()).optional(),
    evidence: z
      .array(
        z.object({
          label: z.string().optional(),
          excerpt: z.string().optional(),
          sourceUrl: z.string().optional(),
          confidence: z.number().optional(),
        }),
      )
      .optional(),
  })
  .passthrough();

export const SequenceRequestSchema = z.object({
  lead: SequenceLeadSchema,
  conference: SequenceConferenceSchema,
  now: z.string().optional(),
});

export const SequenceResponseSchema = z.object({
  id: z.string(),
  leadId: z.string(),
  steps: z.array(SequenceStepSchema),
  drafts: z.array(SequenceDraftSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PatchStepSchema = z.object({
  status: z.enum(["Sent", "Scheduled", "Planned", "Opportunity"]).optional(),
  subject: z.string().nullable().optional(),
});

export const FunnelEventRequestSchema = z.object({
  leadId: z.string().min(1),
  status: LeadStatusSchema,
  at: z.string().optional(),
  conferenceName: z.string().nullable().optional(),
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
  leadStatuses: z.record(z.string(), LeadStatusSchema).optional(),
});

export type LeadStatus = z.infer<typeof LeadStatusSchema>;
export type SequenceStep = z.infer<typeof SequenceStepSchema>;
export type SequenceDraft = z.infer<typeof SequenceDraftSchema>;
export type SequenceConference = z.infer<typeof SequenceConferenceSchema>;
export type SequenceLead = z.infer<typeof SequenceLeadSchema>;
export type SequenceRequest = z.infer<typeof SequenceRequestSchema>;
export type SequenceRecord = z.infer<typeof SequenceResponseSchema> & {
  conference: SequenceConference;
  lead: SequenceLead;
};
export type Funnel = z.infer<typeof FunnelSchema>;
export type FunnelStage = z.infer<typeof FunnelStageSchema>;
export type FunnelEvent = {
  eventId: string;
  leadId: string;
  status: LeadStatus;
  at: string;
  conferenceName?: string | null;
};
