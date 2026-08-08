import type { SeniorityLevel } from "../schemas/lead.js";

export interface SeniorityAssessment {
  level: SeniorityLevel;
  /** 0..1 seniority signal. */
  seniorityScore: number;
  /** 0..1 likelihood this person holds budget / decision authority. */
  buyingInfluence: number;
  /** Human-readable rationale token used in explanations. */
  label: string;
}

// Ordered most-senior-first so the first regex hit wins.
const RULES: Array<{
  level: SeniorityLevel;
  re: RegExp;
  seniority: number;
  buying: number;
  label: string;
}> = [
  {
    level: "c_level",
    re: /\b(ceo|cto|cfo|coo|cio|ciso|cmo|cro|chief|founder|co-?founder|owner|president|managing director|partner|principal owner)\b/i,
    seniority: 1,
    buying: 1,
    label: "C-level / founder (economic buyer)",
  },
  {
    level: "vp",
    re: /\b(vp|svp|evp|vice president|head of|global head|general manager|gm)\b/i,
    seniority: 0.85,
    buying: 0.85,
    label: "VP / Head of (senior decision maker)",
  },
  {
    level: "director",
    re: /\b(director|associate director|senior manager|sr\.? manager)\b/i,
    seniority: 0.65,
    buying: 0.6,
    label: "Director (strong influencer)",
  },
  {
    level: "manager",
    re: /\b(manager|lead|principal|staff|architect|program manager|product manager)\b/i,
    seniority: 0.45,
    buying: 0.4,
    label: "Manager / Lead (influencer)",
  },
  {
    level: "practitioner",
    re: /\b(engineer|developer|scientist|analyst|specialist|consultant|advocate|researcher|designer|associate|coordinator|intern)\b/i,
    seniority: 0.25,
    buying: 0.2,
    label: "Individual contributor",
  },
];

/**
 * Classify a (normalized) job title into a seniority level plus seniority and
 * buying-influence signals. Unknown/empty titles get a neutral-low baseline so
 * they can still qualify on other signals but never dominate the ranking.
 */
export function assessSeniority(
  title: string | null | undefined,
): SeniorityAssessment {
  if (!title || !title.trim()) {
    return {
      level: "unknown",
      seniorityScore: 0.2,
      buyingInfluence: 0.2,
      label: "Unknown seniority",
    };
  }

  for (const rule of RULES) {
    if (rule.re.test(title)) {
      return {
        level: rule.level,
        seniorityScore: rule.seniority,
        buyingInfluence: rule.buying,
        label: rule.label,
      };
    }
  }

  return {
    level: "unknown",
    seniorityScore: 0.3,
    buyingInfluence: 0.3,
    label: "Unclassified title",
  };
}
