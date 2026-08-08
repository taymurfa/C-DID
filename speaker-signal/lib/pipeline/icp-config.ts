/**
 * Ideal Customer Profile (ICP) definition for Candid Intelligence: senior
 * decision-makers at organizations that own, develop, finance, or deliver
 * energy / power / data-center / grid infrastructure. This vocabulary drives the
 * deterministic scoring and gives the OpenAI layer a shared frame.
 */

// Strong domain themes (session/topic/company/bio relevance).
export const TARGET_THEMES: { term: string; weight: number }[] = [
  { term: "data center", weight: 3 },
  { term: "datacenter", weight: 3 },
  { term: "data centers", weight: 3 },
  { term: "power", weight: 3 },
  { term: "energy", weight: 2 },
  { term: "grid", weight: 3 },
  { term: "generation", weight: 3 },
  { term: "transmission", weight: 3 },
  { term: "interconnection", weight: 3 },
  { term: "substation", weight: 3 },
  { term: "microgrid", weight: 3 },
  { term: "behind-the-meter", weight: 3 },
  { term: "onsite generation", weight: 3 },
  { term: "utility", weight: 2 },
  { term: "utilities", weight: 2 },
  { term: "infrastructure", weight: 2 },
  { term: "epc", weight: 3 },
  { term: "construction", weight: 2 },
  { term: "procurement", weight: 3 },
  { term: "storage", weight: 2 },
  { term: "renewable", weight: 2 },
  { term: "renewables", weight: 2 },
  { term: "solar", weight: 2 },
  { term: "gas", weight: 1 },
  { term: "lng", weight: 2 },
  { term: "nuclear", weight: 2 },
  { term: "load growth", weight: 3 },
  { term: "capacity", weight: 1 },
];

// Seniority tiers, checked in order (first match wins).
export const SENIORITY_TIERS: { patterns: RegExp[]; score: number }[] = [
  {
    patterns: [
      /\bchief\b/i,
      /\bc[eiofmt]o\b/i,
      /\bfounder\b/i,
      /\bowner\b/i,
      /\bpresident\b/i,
      /\bmanaging partner\b/i,
      /\bmanaging director\b/i,
      /\bgeneral partner\b/i,
    ],
    score: 15,
  },
  { patterns: [/\b(e|s)vp\b/i, /\bexecutive vice president\b/i, /\bsenior vice president\b/i, /\bpartner\b/i], score: 13 },
  { patterns: [/\bvp\b/i, /\bvice president\b/i], score: 12 },
  { patterns: [/\bhead of\b/i, /\bhead,\b/i, /\bdirector\b/i], score: 11 },
  { patterns: [/\bprincipal\b/i, /\bsenior manager\b/i, /\blead\b/i, /\bstaff\b/i], score: 8 },
  { patterns: [/\bmanager\b/i], score: 6 },
];

// Buying-influence functions, checked in order (first match wins).
export const BUYING_INFLUENCE: { patterns: RegExp[]; score: number }[] = [
  { patterns: [/\bprocurement\b/i, /\bpurchasing\b/i, /\bsourcing\b/i, /\bsupply chain\b/i], score: 10 },
  { patterns: [/\bdevelopment\b/i, /\borigination\b/i], score: 9 },
  { patterns: [/\bproject delivery\b/i, /\bproject\b/i, /\bconstruction\b/i, /\bepc\b/i, /\bdelivery\b/i], score: 8 },
  { patterns: [/\binfrastructure\b/i, /\bfacilit(y|ies)\b/i, /\boperations\b/i, /\basset\b/i], score: 8 },
  { patterns: [/\bcapital\b/i, /\binvest\w*\b/i, /\bfinance\b/i, /\bstrategy\b/i], score: 7 },
  { patterns: [/\bengineer\w*\b/i, /\btechnolog\w*\b/i], score: 6 },
];

// Company / role signals that push the lead OUT of the ICP.
export const NEGATIVE_COMPANY: RegExp[] = [
  /\buniversity\b/i,
  /\bcollege\b/i,
  /\binstitute\b/i,
  /\bmedia\b/i,
  /\bnews\b/i,
  /\bmagazine\b/i,
  /\bjournal\b/i,
  /\bassociation\b/i,
  /\bnonprofit\b/i,
];

export const TIER_THRESHOLDS = { A: 82, B: 68, C: 52 } as const;
