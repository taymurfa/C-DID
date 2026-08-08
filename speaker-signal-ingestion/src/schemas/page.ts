import { z } from "zod";

export const PageTypeSchema = z.enum([
  "overview",
  "agenda",
  "speakers",
  "session",
  "profile",
  "series",
  "unknown",
]);

export type PageType = z.infer<typeof PageTypeSchema>;

export const PageSchema = z.object({
  url: z.string().url(),
  pageType: PageTypeSchema,
  contentHash: z.string(),
  fetchedAt: z.string(),
  // Freshness: true/false when compared against a prior stored run, null when
  // there is nothing to compare against.
  changed: z.boolean().nullable().default(null),
});

export type Page = z.infer<typeof PageSchema>;
