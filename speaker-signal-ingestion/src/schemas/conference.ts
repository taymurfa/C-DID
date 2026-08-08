import { z } from "zod";

export const ConferenceSchema = z.object({
  name: z.string().nullable(),
  websiteUrl: z.string().url(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  location: z.string().nullable(),
});

export type Conference = z.infer<typeof ConferenceSchema>;
