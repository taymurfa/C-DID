"use client";

import { ArrowRight, Check, Mail, Send, Sparkles } from "lucide-react";
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
  const teamInbox = data.teamInbox;
  const canSendDemo = Boolean(data.mailStatus?.canSendDemo);

  return (
    <>
      <div className={`primary-grid sequences-grid${rows.length ? "" : " sequences-empty-grid"}`}>
        <section className="panel page-panel">
          <PanelHeader title="Enrolled sequences" action={`${rows.length} leads`} />
          <div className="sequence-index">
            {rows.length ? rows.map((lead) => {
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
                    {lead.email ? (
                      <small className="sequence-demo-email">Demo → {lead.email}</small>
                    ) : null}
                  </span>
                  <em>{FUNNEL_LABELS[status]}</em>
                  <small>{lead.outreachStage}</small>
                </button>
              );
            }) : <SequenceEmptyState title="No sequences yet" detail="Run a conference scan to qualify contacts and generate outreach drafts." />}
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

            <div className="demo-recipient-chip" role="status">
              <Mail size={14} />
              <span>
                Demo recipient · <strong>{speaker.email || teamInbox}</strong>
              </span>
              <em>{canSendDemo ? "Manual send ready" : "Draft only"}</em>
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

            <div className="sequence-email-list" aria-label="Sequence emails">
              <div className="sequence-email-list-head">
                <span>Emails in this sequence</span>
                <small>{data.drafts.length || data.sequenceSteps.length} drafts</small>
              </div>
              {(data.drafts.length
                ? data.drafts
                : data.sequenceSteps.map((step) => ({
                    anchor: step.anchor,
                    subject:
                      step.subject ||
                      `Quick note ahead of ${speaker.conference}`,
                    body: "",
                    groundedOn: [] as string[],
                    generatedBy: "template" as const,
                  }))
              ).map((draft) => {
                const step = data.sequenceSteps.find((s) => s.anchor === draft.anchor);
                const active = data.activeDraftAnchor === draft.anchor;
                return (
                  <button
                    key={draft.anchor}
                    type="button"
                    className={`sequence-email-row ${active ? "sequence-email-active" : ""}`}
                    onClick={() => data.setActiveDraftAnchor(draft.anchor)}
                  >
                    <span className="sequence-email-anchor">{draft.anchor}</span>
                    <span className="sequence-email-copy">
                      <strong>{draft.subject}</strong>
                      <small>
                        {step
                          ? `${formatShortDate(step.scheduledFor)} · ${step.status}`
                          : draft.generatedBy}
                      </small>
                    </span>
                    {active ? <em>Selected</em> : <em>{step?.status ?? "Draft"}</em>}
                  </button>
                );
              })}
            </div>

            <div className="draft-card">
              <div>
                <Sparkles size={15} />
                <span>Selected draft</span>
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
                Review &amp; send
                <ArrowRight size={14} />
              </button>
            </div>
            <footer className="sequence-footer">
              <span>
                <i />{" "}
                {canSendDemo
                  ? "No automatic sending — pick a draft and send manually"
                  : "Draft only — no automatic sending"}
              </span>
              <strong>
                <Send size={12} /> {data.sequenceSteps.length} touches · → {teamInbox}
              </strong>
            </footer>
          </section>
        ) : <section className="panel sequence-panel page-panel"><PanelHeader title="Event-anchored sequence" action="Waiting for a contact" /><SequenceEmptyState title="Select a contact to review a sequence" detail="Once a conference is scanned, qualified contacts and their event-based outreach drafts will appear here." /></section>}
      </div>

      {reviewOpen && speaker ? (
        <DraftReviewModal
          speaker={speaker}
          draft={data.activeDraft}
          drafts={data.drafts}
          activeAnchor={data.activeDraftAnchor}
          onSelectAnchor={data.setActiveDraftAnchor}
          teamInbox={teamInbox}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}
    </>
  );
}

function SequenceEmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="sequence-empty"><Send size={22} /><strong>{title}</strong><p>{detail}</p></div>;
}
