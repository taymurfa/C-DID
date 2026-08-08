import { z } from "zod";

export const SessionSchema = z.object({
  sourceId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  location: z.string().nullable(),
  topics: z.array(z.string()).default([]),
  sourceUrl: z.string().url(),
  sourceUrls: z.array(z.string().url()),
  speakerSourceIds: z.array(z.string()),
  extractionConfidence: z.number().min(0).max(1),
});

export type Session = z.infer<typeof SessionSchema>;
