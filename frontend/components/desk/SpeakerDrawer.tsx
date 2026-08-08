"use client";

import { ChevronRight, ExternalLink, X } from "lucide-react";
import type { LeadStatus, SequenceDraft, SequenceStep } from "@/lib/contracts";
import { FUNNEL_LABELS, FUNNEL_STAGES, nextLeadStatus } from "@/lib/pipeline/funnel";
import type { DeskLead } from "@/lib/useSignalData";
import { formatShortDate, initials, ScoreBar } from "@/components/desk/shared";

export function SpeakerDrawer({
  lead,
  status,
  steps,
  drafts,
  activeDraft,
  onAdvance,
  onSetStatus,
  onClose,
}: {
  lead: DeskLead;
  status: LeadStatus;
  steps: SequenceStep[];
  drafts: SequenceDraft[];
  activeDraft: SequenceDraft | null;
  onAdvance: () => void;
  onSetStatus: (status: LeadStatus) => void;
  onClose: () => void;
}) {
  const next = nextLeadStatus(status);
  const breakdown = [
    { label: "Topic", value: lead.scoreBreakdown.topicRelevance, max: 25 },
    { label: "Role", value: lead.scoreBreakdown.roleFit, max: 20 },
    { label: "Company", value: lead.scoreBreakdown.companyFit, max: 20 },
    { label: "Seniority", value: lead.scoreBreakdown.seniority, max: 15 },
    { label: "Influence", value: lead.scoreBreakdown.buyingInfluence, max: 10 },
    { label: "Proximity", value: lead.scoreBreakdown.eventProximity, max: 10 },
  ];
  const draftList = drafts.length > 0 ? drafts : activeDraft ? [activeDraft] : [];

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="speaker-drawer"
        role="dialog"
        aria-label="Speaker detail"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <span className="avatar avatar-1">{initials(lead.name)}</span>
          <div>
            <strong>{lead.name}</strong>
            <small>
              {lead.title || "Unknown role"} · {lead.company || "Unknown company"}
            </small>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="drawer-score">
          <span>
            {lead.score}
            <small>Tier {lead.tier}</small>
          </span>
          <p>{lead.scoreReason}</p>
          <em>Confidence {(lead.confidence * 100).toFixed(0)}%</em>
        </div>

        <section className="drawer-status">
          <div className="status-control">
            <span className="mini-label">Funnel status</span>
            <strong>{FUNNEL_LABELS[status]}</strong>
            <button type="button" disabled={!next} onClick={onAdvance}>
              Advance{next ? ` → ${FUNNEL_LABELS[next]}` : ""}
              <ChevronRight size={14} />
            </button>
          </div>
          <label className="sr-only" htmlFor="lead-status">
            Set lead status
          </label>
          <select
            id="lead-status"
            value={status}
            onChange={(event) => onSetStatus(event.target.value as LeadStatus)}
          >
            {FUNNEL_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {FUNNEL_LABELS[stage]}
              </option>
            ))}
          </select>
        </section>

        <section>
          <span className="mini-label">Score breakdown</span>
          <div className="score-bars drawer-bars">
            {breakdown.map((row) => (
              <ScoreBar key={row.label} label={row.label} value={row.value} max={row.max} />
            ))}
          </div>
        </section>

        <section>
          <span className="mini-label">Evidence</span>
          {lead.evidence.map((evidence) => (
            <a
              key={`${evidence.sourceUrl}-${evidence.label}`}
              href={evidence.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="drawer-evidence"
            >
              <strong>{evidence.label}</strong>
              <span>{evidence.excerpt}</span>
              <ExternalLink size={12} />
            </a>
          ))}
          {lead.topics?.length ? (
            <p className="drawer-topics">Topics: {lead.topics.join(" · ")}</p>
          ) : null}
        </section>

        <section>
          <span className="mini-label">Generated sequence</span>
          <div className="drawer-sequence">
            {steps.map((step) => {
              const draft = draftList.find((d) => d.anchor === step.anchor);
              return (
                <article key={step.id}>
                  <header>
                    <strong>
                      {step.anchor} · {step.label}
                    </strong>
                    <small>
                      {formatShortDate(step.scheduledFor)} · {step.status}
                    </small>
                  </header>
                  {draft ? (
                    <>
                      <em>{draft.subject}</em>
                      <p>{draft.body}</p>
                      <small>
                        Grounded on: {draft.groundedOn.join(" · ") || "session evidence"}
                      </small>
                    </>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </aside>
    </div>
  );
}
