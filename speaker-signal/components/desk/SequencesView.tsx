"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { FUNNEL_LABELS } from "@/lib/pipeline/funnel";
import { useSignalData } from "@/lib/useSignalData";
import { useDeskUi } from "@/components/desk/DeskShell";
import { DraftReviewModal } from "@/components/desk/DraftReviewModal";
import {
  formatShortDate,
  initials,
  PanelHeader,
} from "@/components/desk/shared";

export function SequencesView() {
  const data = useSignalData();
  const { openSpeaker } = useDeskUi();
  const [reviewOpen, setReviewOpen] = useState(false);

  const enrolled = data.filteredLeads.filter((lead) => {
    const status = data.statuses[lead.id] ?? "identified";
    return status !== "identified" || lead.outreachStage !== "Identified";
  });
  const rows = enrolled.length > 0 ? enrolled : data.filteredLeads;
  const speaker = data.selected;

  return (
    <>
      <div className="primary-grid sequences-grid">
        <section className="panel page-panel">
          <PanelHeader title="Enrolled sequences" action={`${rows.length} leads`} />
          <div className="sequence-index">
            {rows.map((lead) => {
              const status = data.statuses[lead.id] ?? "identified";
              const active = lead.id === data.selected?.id;
              return (
                <button
                  key={lead.id}
                  type="button"
                  className={`sequence-index-row ${active ? "sequence-index-active" : ""}`}
                  onClick={() => {
                    data.setSelectedId(lead.id);
                  }}
                >
                  <span className="avatar avatar-1">{initials(lead.name)}</span>
                  <span>
                    <strong>{lead.name}</strong>
                    <small>
                      {lead.company || "Unknown"} · {lead.conference}
                    </small>
                  </span>
                  <em>{FUNNEL_LABELS[status]}</em>
                  <small>{lead.outreachStage}</small>
                </button>
              );
            })}
          </div>
        </section>

        {speaker ? (
          <section className="panel sequence-panel page-panel">
            <PanelHeader
              title="Event-anchored sequence"
              action="Open speaker"
              onAction={() => openSpeaker(speaker.id)}
            />
            <div className="sequence-person">
              <span className="avatar avatar-1">{initials(speaker.name)}</span>
              <div>
                <strong>{speaker.name}</strong>
                <small>
                  {speaker.company} · {speaker.conference}
                </small>
              </div>
              <span className="sequence-score">
                {speaker.score}
                <small>signal</small>
              </span>
            </div>
            <div className="sequence-line" aria-label="Outreach sequence timeline">
              {data.sequenceSteps.map((step, index) => (
                <article
                  key={step.id}
                  className={`sequence-step step-${step.status.toLowerCase()} ${data.activeDraftAnchor === step.anchor ? "step-active" : ""}`}
                >
                  <button
                    className="step-select"
                    onClick={() => data.setActiveDraftAnchor(step.anchor)}
                    type="button"
                  >
                    <div className="step-anchor">
                      <span>{step.anchor}</span>
                      <small>{formatShortDate(step.scheduledFor)}</small>
                    </div>
                    <span className="step-node">
                      {step.status === "Sent" ? <Check size={12} /> : index + 1}
                    </span>
                    <div className="step-copy">
                      <strong>{step.label}</strong>
                      <small>
                        {step.subject ||
                          data.drafts.find((d) => d.anchor === step.anchor)?.subject ||
                          "Meet in person"}
                      </small>
                      <em>{step.status}</em>
                    </div>
                  </button>
                </article>
              ))}
            </div>
            <div className="draft-card">
              <div>
                <Sparkles size={15} />
                <span>Personalized draft</span>
                <small>
                  {data.sequenceLoading
                    ? "Generating…"
                    : data.activeDraft
                      ? `${data.activeDraft.generatedBy === "openai" ? "OpenAI" : "Template"} · ${data.activeDraft.anchor}`
                      : "Grounded in published session evidence"}
                </small>
              </div>
              <p>
                {data.activeDraft?.body
                  ? data.activeDraft.body.split("\n").slice(0, 4).join(" ")
                  : `“Your session on ${speaker.session?.toLowerCase() ?? "the agenda"} caught my eye…”`}
              </p>
              <button type="button" onClick={() => setReviewOpen(true)}>
                Review draft
                <ArrowRight size={14} />
              </button>
            </div>
            <footer className="sequence-footer">
              <span>
                <i /> Draft only — no automatic sending
              </span>
              <strong>
                {data.sequenceSteps.length} touches · demo send → team inbox
              </strong>
            </footer>
          </section>
        ) : null}
      </div>

      {reviewOpen && speaker ? (
        <DraftReviewModal
          speaker={speaker}
          draft={data.activeDraft}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}
    </>
  );
}
