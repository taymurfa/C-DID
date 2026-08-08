export type RadarSource = "ercot_gis" | "puct" | "tceq";

export type ScoredRadarProject = {
  canonicalId: string;
  name: string;
  aliases: string[];
  owners: string[];
  primaryOwner: string;
  fuel: string;
  mw: number;
  county?: string;
  zone?: string;
  lat?: number;
  lon?: number;
  codYear?: number;
  sources: Array<{
    source: RadarSource;
    sourceId: string;
    recordId: string;
    name: string;
    milestone?: string;
    evidence: string;
  }>;
  hardEr?: boolean;
  clusterId?: string;
  stage: string;
  stageConfidence: number;
  stageEvidence: Array<{
    source: string;
    sourceId: string;
    milestone?: string;
    note: string;
  }>;
  rankScore: number;
  reason: string;
  btmOrGasToPower: boolean;
};

export type RadarJoin = {
  projectId: string;
  projectName: string;
  company: string;
  people: Array<{
    name: string;
    title: string;
    company: string;
    conference?: string;
    topic?: string;
  }>;
};

export type RadarDemoResponse = {
  ok?: boolean;
  error?: string;
  detail?: unknown;
  mode?: string;
  ingest?: { runId?: string; recordCount?: number; sources?: string[] };
  normalize?: { normalizeId?: string; projectCount?: number };
  score?: { scoreId?: string; projectCount?: number };
  projects?: ScoredRadarProject[];
  joins?: RadarJoin[];
};
