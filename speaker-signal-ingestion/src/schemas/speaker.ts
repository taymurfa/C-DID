import { z } from "zod";

// Light role classification by Agent 1. It distinguishes obvious non-speakers
// but still passes everyone downstream; Agent 2 decides lead quality.
export const PersonRoleSchema = z.enum([
  "speaker",
  "moderator",
  "sponsor",
  "staff",
  "exhibitor",
  "journalist",
  "unknown",
]);

export type PersonRole = z.infer<typeof PersonRoleSchema>;

export const SpeakerSchema = z.object({
  sourceId: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  bio: z.string().nullable(),
  // Public LinkedIn profile URL as published on the conference site (we do not
  // fetch LinkedIn directly). Null when the site does not link one.
  linkedinUrl: z.string().url().nullable().default(null),
  role: PersonRoleSchema.default("speaker"),
  topics: z.array(z.string()).default([]),
  // Primary source (kept for backward compatibility) plus full evidence list.
  sourceUrl: z.string().url(),
  sourceUrls: z.array(z.string().url()),
  sessionSourceIds: z.array(z.string()),
  extractionConfidence: z.number().min(0).max(1),
});

export type Speaker = z.infer<typeof SpeakerSchema>;
