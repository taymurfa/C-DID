import { z } from "zod";

export const ProjectStageSchema = z.enum([
  "Concept",
  "FEL-1",
  "FEL-2 / pre-FEED",
  "FEED",
  "Interconnection",
  "FID",
  "Construction",
  "COD",
]);

export const ProjectSourceTypeSchema = z.enum([
  "ERCOT",
  "PUCT",
  "FERC",
  "TCEQ",
  "County agenda",
  "Equipment",
  "Finance",
  "News",
]);

export const ProjectEvidenceSchema = z.object({
  id: z.string(),
  sourceType: ProjectSourceTypeSchema,
  sourceName: z.string(),
  title: z.string(),
  sourceUrl: z.url(),
  observedAt: z.iso.datetime(),
  excerpt: z.string(),
  confidence: z.enum(["High", "Medium", "Low"]),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  company: z.string(),
  projectType: z.string(),
  capacityMw: z.number().nonnegative().nullable(),
  county: z.string(),
  state: z.string(),
  coordinates: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }),
  stage: ProjectStageSchema,
  stageConfidence: z.number().min(0).max(1),
  score: z.number().min(0).max(100),
  latestSignal: z.string(),
  updatedAt: z.iso.datetime(),
  stageChanged: z.boolean(),
  evidence: z.array(ProjectEvidenceSchema),
});

export const ProjectRefreshRequestSchema = z
  .object({
    demoMode: z.boolean().default(true),
    sourceUrls: z.array(z.url()).min(1).max(8).optional(),
  })
  .refine((value) => value.demoMode || value.sourceUrls?.length, {
    message: "Provide at least one public source URL for a live refresh.",
  });

export const ProjectRefreshResponseSchema = z.object({
  mode: z.enum(["demo", "live"]),
  refreshedAt: z.iso.datetime(),
  sourceCount: z.number().int().nonnegative(),
  projects: z.array(ProjectSchema),
});

export type ProjectStage = z.infer<typeof ProjectStageSchema>;
export type ProjectSourceType = z.infer<typeof ProjectSourceTypeSchema>;
export type ProjectEvidence = z.infer<typeof ProjectEvidenceSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectRefreshResponse = z.infer<typeof ProjectRefreshResponseSchema>;

export const PROJECT_STAGES = ProjectStageSchema.options;

const STAGE_PATTERNS: Array<{ stage: ProjectStage; patterns: RegExp[] }> = [
  { stage: "COD", patterns: [/commercial operation/i, /\bCOD\b/i, /entered service/i, /operational/i] },
  { stage: "Construction", patterns: [/under construction/i, /construction (?:began|started|underway)/i, /notice to proceed/i] },
  { stage: "FID", patterns: [/final investment decision/i, /\bFID\b/i, /sanctioned the project/i] },
  { stage: "Interconnection", patterns: [/interconnection agreement/i, /generator interconnection/i, /queue position/i, /\bGIA\b/i] },
  { stage: "FEED", patterns: [/front[- ]end engineering design/i, /\bFEED\b/i] },
  { stage: "FEL-2 / pre-FEED", patterns: [/pre[- ]FEED/i, /\bFEL[- ]?2\b/i, /feasibility stud/i] },
  { stage: "FEL-1", patterns: [/\bFEL[- ]?1\b/i, /concept select/i, /scoping stud/i] },
];

const STAGE_RANK = new Map(PROJECT_STAGES.map((stage, index) => [stage, index]));

export function inferProjectStage(text: string): { stage: ProjectStage; confidence: number; evidence: string } {
  for (const candidate of STAGE_PATTERNS) {
    const matched = candidate.patterns.find((pattern) => pattern.test(text));
    if (matched) {
      const match = text.match(matched)?.[0] ?? candidate.stage;
      return { stage: candidate.stage, confidence: 0.88, evidence: match };
    }
  }
  return { stage: "Concept", confidence: 0.48, evidence: "No later-stage milestone found" };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "project";
}

const NAME_STOP_WORDS = new Set([
  "the", "project", "energy", "power", "plant", "facility", "llc", "inc", "company", "phase", "development",
]);

export function normalizedProjectTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/data[ -]?center/g, "datacenter")
    .replace(/combined[ -]?cycle/g, "ccgt")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !NAME_STOP_WORDS.has(token));
}

function tokenSimilarity(left: string, right: string): number {
  const a = new Set(normalizedProjectTokens(left));
  const b = new Set(normalizedProjectTokens(right));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

function sourceTypeForUrl(url: string): ProjectSourceType {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("ercot")) return "ERCOT";
  if (host.includes("puc") || host.includes("interchange")) return "PUCT";
  if (host.includes("ferc")) return "FERC";
  if (host.includes("tceq")) return "TCEQ";
  if (host.includes("county") || host.includes("agenda")) return "County agenda";
  if (host.includes("finance") || host.includes("sec.gov")) return "Finance";
  return "News";
}

function deterministicCoordinates(seed: string): { x: number; y: number } {
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return { x: 18 + (hash % 64), y: 17 + ((hash >>> 8) % 68) };
}

function extractCapacityMw(text: string): number | null {
  const match = text.match(/(\d{1,5}(?:\.\d+)?)\s*(MW|GW)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return match[2].toUpperCase() === "GW" ? value * 1000 : value;
}

function readableTitle(value: string | undefined, url: string): string {
  const fallback = new URL(url).hostname.replace(/^www\./, "");
  return (value || fallback).split(/\s+[|–—]\s+/)[0].trim().slice(0, 100);
}

export function projectFromDocument(input: { url: string; title?: string; markdown: string; observedAt?: Date }): Project {
  const name = readableTitle(input.title, input.url);
  const stage = inferProjectStage(input.markdown);
  const capacityMw = extractCapacityMw(input.markdown);
  const observedAt = (input.observedAt ?? new Date()).toISOString();
  const sourceType = sourceTypeForUrl(input.url);
  const excerpt = input.markdown.replace(/\s+/g, " ").trim().slice(0, 240) || "Public source page retrieved.";
  const signalPoints = (capacityMw ? 12 : 0) + Math.round(stage.confidence * 18);
  const earlyStageBonus = Math.max(0, 28 - (STAGE_RANK.get(stage.stage) ?? 0) * 3);

  return ProjectSchema.parse({
    id: slugify(`${name}-${new URL(input.url).hostname}`),
    name,
    aliases: [],
    company: "Owner not yet resolved",
    projectType: /data[ -]?center/i.test(input.markdown) ? "Data-center power" : /battery|storage|\bBESS\b/i.test(input.markdown) ? "Battery storage" : /gas|ccgt/i.test(input.markdown) ? "Gas-to-power" : "Energy infrastructure",
    capacityMw,
    county: "Location not yet resolved",
    state: "Unknown",
    coordinates: deterministicCoordinates(input.url),
    stage: stage.stage,
    stageConfidence: stage.confidence,
    score: Math.min(100, 42 + signalPoints + earlyStageBonus),
    latestSignal: `${sourceType}: ${stage.evidence}`,
    updatedAt: observedAt,
    stageChanged: stage.stage !== "Concept",
    evidence: [{
      id: slugify(`${input.url}-${observedAt}`),
      sourceType,
      sourceName: new URL(input.url).hostname.replace(/^www\./, ""),
      title: name,
      sourceUrl: input.url,
      observedAt,
      excerpt,
      confidence: stage.confidence >= 0.8 ? "High" : "Medium",
    }],
  });
}

function mergeProjectRecords(primary: Project, incoming: Project): Project {
  const primaryStage = STAGE_RANK.get(primary.stage) ?? 0;
  const incomingStage = STAGE_RANK.get(incoming.stage) ?? 0;
  const mostAdvanced = incomingStage > primaryStage ? incoming : primary;
  const aliases = new Set([...primary.aliases, ...incoming.aliases]);
  if (primary.name !== incoming.name) aliases.add(incoming.name);
  const evidence = [...primary.evidence, ...incoming.evidence].filter(
    (item, index, all) => all.findIndex((candidate) => candidate.sourceUrl === item.sourceUrl && candidate.title === item.title) === index,
  );

  return ProjectSchema.parse({
    ...primary,
    aliases: [...aliases],
    company: primary.company === "Owner not yet resolved" ? incoming.company : primary.company,
    capacityMw: primary.capacityMw ?? incoming.capacityMw,
    stage: mostAdvanced.stage,
    stageConfidence: Math.max(primary.stageConfidence, incoming.stageConfidence),
    score: Math.min(100, Math.max(primary.score, incoming.score) + Math.min(5, evidence.length - 1)),
    latestSignal: incoming.updatedAt > primary.updatedAt ? incoming.latestSignal : primary.latestSignal,
    updatedAt: incoming.updatedAt > primary.updatedAt ? incoming.updatedAt : primary.updatedAt,
    stageChanged: primary.stageChanged || incoming.stageChanged,
    evidence,
  });
}

export function resolveProjects(projects: Project[]): Project[] {
  const resolved: Project[] = [];
  for (const project of projects) {
    const matchIndex = resolved.findIndex((candidate) =>
      candidate.company === project.company && candidate.company !== "Owner not yet resolved"
        ? tokenSimilarity(candidate.name, project.name) >= 0.45
        : tokenSimilarity(candidate.name, project.name) >= 0.72,
    );
    if (matchIndex === -1) resolved.push(project);
    else resolved[matchIndex] = mergeProjectRecords(resolved[matchIndex], project);
  }
  return resolved.sort((a, b) => b.score - a.score || b.evidence.length - a.evidence.length);
}
