/**
 * The Ideal Customer Profile (ICP) definition and scoring weights for Agent 2.
 *
 * The domain mirrors Agent 1's focus: energy / power / data-center /
 * infrastructure. Companies and sessions that touch these themes are the ones
 * worth selling into. This is the deterministic backbone; OpenAI (when
 * configured) refines the company `icpFit` signal with judgment the keyword
 * list can't capture.
 */

// Canonical ICP topics. These align with Agent 1's canonical topic tags.
export const ICP_TOPICS = [
  "data centers",
  "power",
  "energy",
  "generation",
  "grid",
  "transmission",
  "interconnection",
  "utilities",
  "infrastructure",
  "epc",
  "construction",
  "microgrids",
  "behind-the-meter",
  "onsite generation",
  "gas/lng",
  "renewables",
  "ai",
];

// Free-text keywords (matched against company names, bios, session text) that
// indicate the person/company operates in our target market.
export const ICP_KEYWORDS = [
  "data center",
  "datacenter",
  "power",
  "energy",
  "electric",
  "electrical",
  "grid",
  "transmission",
  "distribution",
  "substation",
  "interconnection",
  "utility",
  "utilities",
  "generation",
  "renewable",
  "solar",
  "wind",
  "battery",
  "storage",
  "nuclear",
  "gas",
  "lng",
  "microgrid",
  "behind-the-meter",
  "infrastructure",
  "epc",
  "engineering",
  "construction",
  "developer",
  "development",
  "capital",
  "hyperscale",
  "cooling",
  "hvac",
];

// Weights for the six blended signals. Must sum to 1.0.
export const SCORE_WEIGHTS = {
  roleFit: 0.1,
  companyIcpFit: 0.25,
  seniority: 0.2,
  topicRelevance: 0.2,
  buyingInfluence: 0.2,
  confidence: 0.05,
} as const;

export type ScoreWeightKey = keyof typeof SCORE_WEIGHTS;

// Tier cutoffs applied to the 0-100 total score.
export const TIER_CUTOFFS = {
  A: 75,
  B: 60,
  C: 45,
} as const;
