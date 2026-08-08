"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Send,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { useSignalData } from "@/lib/useSignalData";
import { useDeskUi } from "@/components/desk/DeskShell";
import {
  deskHref,
  formatShortDate,
  initials,
  Metric,
  PanelHeader,
  SpeakerRow,
} from "@/components/desk/shared";

export function OverviewView() {
  const data = useSignalData();
  const { basePath, openSpeaker } = useDeskUi();
  const qualifiedCount = data.stats?.qualified ?? data.leads.length;
  const previewSpeakers = data.filteredLeads.slice(0, 3);
  const speaker = data.selected;

  return (
    <>
      <section className="metric-strip" aria-label="Key metrics">
        <Metric
          icon={CalendarDays}
          label="Upcoming conferences"
          value={String(data.conferences.length)}
          note={
            data.selectedConference
              ? `Focus: ${data.selectedConference.name}`
              : "Select a conference"
          }
        />
        <Metric
          icon={UsersRound}
          label="Qualified speakers"
          value={String(qualifiedCount)}
          note={
            data.stats
              ? `${data.stats.afterDedupe} after dedupe`
              : data.bootstrapped
                ? "Awaiting analyze"
                : "Loading pipeline…"
          }
          positive
        />
        <Metric
          icon={Send}
          label="Active sequences"
          value={String(data.activeSequences)}
          note={`${data.filteredLeads.length} in view`}
        />
        <Metric
          icon={Target}
          label="Meetings booked"
          value={String(data.meetingsBooked)}
          note={data.funnelSource === "api" ? "From Agent 3 funnel" : "Local lead status"}
          positive
        />
      </section>

      <div className="primary-grid">
        <section className="panel speakers-panel">
          <PanelHeader
            title="High-signal speakers"
            action="View all speakers"
            href={deskHref(basePath, "/speakers")}
          />
          <div className="speaker-head" aria-hidden="true">
            <span>#</span>
            <span>Speaker</span>
            <span>Role / company</span>
            <span>Score</span>
            <span>Conference / session</span>
            <span>Outreach</span>
          </div>
          <div className="speaker-list">
            {previewSpeakers.map((row, index) => (
              <SpeakerRow
                key={row.id}
                speaker={row}
                rank={index + 1}
                selected={row.id === data.selected?.id}
                status={data.statuses[row.id] ?? "identified"}
                onSelect={() => openSpeaker(row.id)}
                showEvidence={false}
              />
            ))}
          </div>
          <footer className="panel-footer">
            <Link href={deskHref(basePath, "/speakers")} className="panel-action-link">
              View all {data.filteredLeads.length} speakers
              <ArrowRight size={14} />
            </Link>
            <span>
              {Math.min(3, data.filteredLeads.length)} shown · {qualifiedCount} qualified
            </span>
          </footer>
        </section>

        {speaker ? (
          <section className="panel sequence-panel">
            <PanelHeader
              title="Event-anchored sequence"
              action="View all sequences"
              href={deskHref(basePath, "/sequences")}
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
              {data.sequenceSteps.slice(0, 3).map((step, index) => (
                <article
                  key={step.id}
                  className={`sequence-step step-${step.status.toLowerCase()}`}
                >
                  <div className="step-select static-step">
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
                  </div>
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
              <Link href={deskHref(basePath, "/sequences")} className="panel-action-link">
                Review on Sequences
                <ArrowRight size={14} />
              </Link>
            </div>
            <footer className="sequence-footer">
              <span>
                <i /> Draft only — no automatic sending
              </span>
              <strong>{data.sequenceSteps.length} touches</strong>
            </footer>
          </section>
        ) : null}
      </div>

      <div className="secondary-grid">
        <section className="panel events-panel">
          <PanelHeader
            title="Upcoming events"
            action="View all conferences"
            href={deskHref(basePath, "/conferences")}
          />
          <div className="event-rail">
            {data.conferences.slice(0, 4).map((conference) => (
              <article
                key={conference.id}
                className={
                  conference.id === data.selectedConferenceId ? "event-selected" : ""
                }
              >
                <button
                  type="button"
                  className="event-select"
                  onClick={() => data.selectConference(conference.id)}
                >
                  <small>
                    {formatShortDate(conference.startDate)} –{" "}
                    {formatShortDate(conference.endDate)}
                  </small>
                  <strong>{conference.name}</strong>
                  <span>{conference.city}</span>
                  <div>
                    <UsersRound size={13} />
                    {conference.speakerCount}
                    <Target size={13} />
                    {conference.qualifiedCount}
                  </div>
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel funnel-panel">
          <PanelHeader
            title="Pipeline funnel"
            action="View funnel"
            href={deskHref(basePath, "/funnel")}
          />
          <div className="funnel-meta">
            <span>Lead statuses</span>
            <span>
              <i /> {data.funnelSource === "api" ? "Agent 3" : "Local"}
            </span>
          </div>
          <div className="funnel-chart funnel-chart-7">
            {data.funnel.stages.map((stage) => (
              <div key={stage.stage} className="funnel-stage">
                <span>{stage.label}</span>
                <strong>{stage.count}</strong>
                <small>
                  {stage.conversionFromPrior === null
                    ? "Source set"
                    : `${stage.conversionFromPrior}% from prior`}
                </small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
