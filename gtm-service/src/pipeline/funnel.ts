import type { Funnel, FunnelStage, LeadStatus } from "../schemas/gtm.js";

export const FUNNEL_STAGES: readonly LeadStatus[] = [
  "identified",
  "contacted",
  "replied",
  "meeting",
  "met",
  "follow-up",
  "booked",
] as const;

export const FUNNEL_LABELS: Record<LeadStatus, string> = {
  identified: "Identified",
  contacted: "Contacted",
  replied: "Replied",
  meeting: "Meeting",
  met: "Met",
  "follow-up": "Follow-up",
  booked: "Booked",
};

export type LeadWithStatus = { status: LeadStatus };

function stageIndex(status: LeadStatus): number {
  return FUNNEL_STAGES.indexOf(status);
}

/**
 * Roll leads into the 7 funnel stages. A lead at stage S counts in every
 * prior stage (classic funnel roll-up).
 */
export function computeFunnel(leadsWithStatus: LeadWithStatus[]): Funnel {
  const counts = FUNNEL_STAGES.map(
    (_, index) =>
      leadsWithStatus.filter((lead) => stageIndex(lead.status) >= index).length,
  );

  const stages: FunnelStage[] = FUNNEL_STAGES.map((stage, index) => {
    const count = counts[index];
    const prior = index === 0 ? null : counts[index - 1];
    const conversionFromPrior =
      prior === null ? null : prior === 0 ? 0 : Math.round((count / prior) * 100);
    return {
      stage,
      label: FUNNEL_LABELS[stage],
      count,
      conversionFromPrior,
    };
  });

  let dropOff: Funnel["dropOff"] = null;
  for (let i = 1; i < stages.length; i += 1) {
    const lost = Math.max(0, stages[i - 1].count - stages[i].count);
    if (lost > 0 && (!dropOff || lost > dropOff.lost)) {
      dropOff = {
        from: stages[i - 1].stage,
        to: stages[i].stage,
        fromLabel: stages[i - 1].label,
        toLabel: stages[i].label,
        lost,
      };
    }
  }

  return { stages, dropOff };
}

export function nextLeadStatus(current: LeadStatus): LeadStatus | null {
  const index = stageIndex(current);
  if (index < 0 || index >= FUNNEL_STAGES.length - 1) return null;
  return FUNNEL_STAGES[index + 1];
}

export function previousLeadStatus(current: LeadStatus): LeadStatus | null {
  const index = stageIndex(current);
  if (index <= 0) return null;
  return FUNNEL_STAGES[index - 1];
}
