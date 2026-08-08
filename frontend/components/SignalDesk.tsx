"use client";

import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Database,
  ExternalLink,
  Filter,
  GitBranch,
  Link2,
  LoaderCircle,
  Menu,
  Play,
  Search,
  Send,
  Sparkles,
  Target,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { Conference, LeadStatus, SequenceDraft, SequenceStep, Speaker } from "@/lib/contracts";
import { FUNNEL_LABELS, FUNNEL_STAGES, nextLeadStatus } from "@/lib/pipeline/funnel";
import { type DeskLead, useSignalData } from "@/lib/useSignalData";

type NavItem = { label: string; icon: LucideIcon; target: string };

const nav: NavItem[] = [
  { label: "Overview", icon: Activity, target: "overview" },
  { label: "Conferences", icon: CalendarDays, target: "events" },
  { label: "Speakers", icon: UserRound, target: "speakers" },
  { label: "Companies", icon: Building2, target: "speakers" },
  { label: "Sequences", icon: Send, target: "sequence" },
  { label: "Funnel", icon: Filter, target: "funnel" },
  { label: "Agent Runs", icon: Bot, target: "pipeline" },
];

const pipeline = [
  { label: "Crawl", detail: "pages", icon: Link2 },
  { label: "Extract", detail: "claims", icon: Search },
  { label: "Resolve", detail: "entities", icon: GitBranch },
  { label: "Score", detail: "qualified", icon: Target },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

export function SignalDesk() {
  const data = useSignalData();
  const [activeNav, setActiveNav] = useState("Overview");
  const [showAll, setShowAll] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleSpeakers = showAll ? data.filteredLeads : data.filteredLeads.slice(0, 3);
  const qualifiedCount = data.stats?.qualified ?? data.leads.length;

  function navigate(item: NavItem) {
    setActiveNav(item.label);
    setMobileNav(false);
    document.getElementById(item.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectSpeaker(id: string) {
    data.setSelectedId(id);
    setDrawerOpen(true);
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /><span /><span /></div>
          <div>
            <strong>Speaker Signal</strong>
            <small>by Candid Intelligence</small>
          </div>
          <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <nav aria-label="Primary navigation">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} className={activeNav === item.label ? "nav-active" : ""} onClick={() => navigate(item)}>
                <Icon size={18} strokeWidth={1.7} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <PipelineRail
          activeIndex={data.pipelineIndex}
          isAnalyzing={data.isAnalyzing}
          stats={data.stats}
          systemHealth={data.systemHealth}
        />
        <div className="profile">
          <span className="profile-avatar">AK</span>
          <span><strong>Alex Kim</strong><small>Candid Intelligence</small></span>
          <ChevronDown size={16} />
        </div>
      </aside>

      <section className="workspace" id="overview">
        <header className="command-bar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <h1>Signal Desk</h1>
          <label className="url-field">
            <Link2 size={17} />
            <span className="sr-only">Conference URL</span>
            <input
              value={data.url}
              onChange={(event) => data.setUrl(event.target.value)}
              placeholder="Paste a public conference agenda URL"
              disabled={data.demoMode}
            />
            {data.url ? <button onClick={() => data.setUrl("")} aria-label="Clear URL"><X size={16} /></button> : null}
          </label>
          <button
            className="analyze-button"
            disabled={data.isAnalyzing || (!data.demoMode && !data.url)}
            onClick={data.analyzeConference}
          >
            {data.isAnalyzing ? <LoaderCircle className="spin" size={17} /> : <Play size={17} fill="currentColor" />}
            {data.isAnalyzing ? pipeline[Math.min(data.pipelineIndex, 3)]?.label || "Analyzing" : "Analyze conference"}
          </button>
          <button className="mode-button" onClick={() => data.setDemoMode((value) => !value)} aria-pressed={data.demoMode}>
            <Database size={16} />
            {data.demoMode ? "Demo data" : "Live agents"}
            <ChevronDown size={15} />
          </button>
          {!data.demoMode ? (
            <button
              className="mode-button"
              onClick={data.discoverConferences}
              disabled={data.isAnalyzing}
              title="Discover events via Agent 1"
            >
              <Search size={16} />
              Discover
            </button>
          ) : null}
        </header>

        {data.notice || data.error ? (
          <div className={`analysis-notice ${data.error ? "notice-error" : ""}`} role="status">
            {data.error ? <CircleDot size={16} /> : <CheckCircle2 size={16} />}
            <span>{data.error || data.notice?.message}</span>
            {data.notice && (
              <small>
                {data.notice.mode.toUpperCase()}
                {data.notice.degraded ? " · DEGRADED" : ""}
                {" · "}
                {data.notice.speakersIngested} ingested · {data.notice.qualified} qualified
              </small>
            )}
            <button onClick={data.dismissNotice} aria-label="Dismiss"><X size={15} /></button>
          </div>
        ) : null}

        <section className="metric-strip" aria-label="Key metrics">
          <Metric
            icon={CalendarDays}
            label="Upcoming conferences"
            value={String(data.conferences.length)}
            note={data.selectedConference ? `Focus: ${data.selectedConference.name}` : "Select a conference"}
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
          <section className="panel speakers-panel" id="speakers">
            <PanelHeader
              title="High-signal speakers"
              action={showAll ? "Show top 3" : "View all speakers"}
              onAction={() => setShowAll((value) => !value)}
            />
            <div className="speaker-head" aria-hidden="true">
              <span>#</span><span>Speaker</span><span>Role / company</span><span>Score</span><span>Conference / session</span><span>Outreach</span>
            </div>
            <div className="speaker-list">
              {visibleSpeakers.map((speaker, index) => (
                <SpeakerRow
                  key={speaker.id}
                  speaker={speaker}
                  rank={index + 1}
                  selected={speaker.id === data.selected?.id}
                  status={data.statuses[speaker.id] ?? "identified"}
                  onSelect={() => selectSpeaker(speaker.id)}
                />
              ))}
            </div>
            <footer className="panel-footer">
              <button onClick={() => setShowAll((value) => !value)}>
                {showAll ? "Show top 3" : `View all ${data.filteredLeads.length} speakers`}
                <ChevronRight size={15} />
              </button>
              <span>
                {showAll ? data.filteredLeads.length : Math.min(3, data.filteredLeads.length)} shown · {qualifiedCount} qualified
              </span>
            </footer>
          </section>

          <SequencePanel
            speaker={data.selected}
            steps={data.sequenceSteps}
            draft={data.activeDraft}
            drafts={data.drafts}
            activeAnchor={data.activeDraftAnchor}
            onSelectAnchor={data.setActiveDraftAnchor}
            loading={data.sequenceLoading}
          />
        </div>

        <div className="secondary-grid">
          <EventsPanel
            conferences={data.conferences}
            selectedId={data.selectedConferenceId}
            onSelect={data.selectConference}
          />
          <FunnelPanel funnel={data.funnel} source={data.funnelSource} />
        </div>
      </section>

      {drawerOpen && data.selected ? (
        <DetailDrawer
          lead={data.selected}
          status={data.statuses[data.selected.id] ?? "identified"}
          steps={data.sequenceSteps}
          drafts={data.drafts}
          activeDraft={data.activeDraft}
          onAdvance={() => data.advanceStatus(data.selected.id)}
          onSetStatus={(status) => data.setLeadStatus(data.selected.id, status)}
          onClose={() => setDrawerOpen(false)}
        />
      ) : null}
    </main>
  );
}

function PipelineRail({
  activeIndex,
  isAnalyzing,
  stats,
  systemHealth,
}: {
  activeIndex: number;
  isAnalyzing: boolean;
  stats: { speakersIngested: number; afterDedupe: number; qualified: number } | null;
  systemHealth: ReturnType<typeof useSignalData>["systemHealth"];
}) {
  const details = [
    stats ? `${stats.speakersIngested} speakers` : "pages",
    stats ? `${stats.afterDedupe} unique` : "claims",
    stats ? `${stats.afterDedupe} entities` : "entities",
    stats ? `${stats.qualified} qualified` : "qualified",
  ];

  const agents = [
    { key: "ingestion" as const, label: ":8001", title: "Ingestion" },
    { key: "intelligence" as const, label: ":8002", title: "Intelligence" },
    { key: "gtm" as const, label: ":8003", title: "GTM" },
  ];

  const allOk = systemHealth.status === "ok";

  return (
    <section className="pipeline-rail" id="pipeline">
      <div className="pipeline-title">
        <span>System health</span>
        <i className={`${allOk ? "" : "dot-warn"} ${isAnalyzing ? "dot-live" : ""}`} />
      </div>
      <div className="agent-health-row" aria-label="Agent service status">
        {agents.map((agent) => {
          const health = systemHealth.agents[agent.key];
          const ok = health.status === "ok";
          const mongo = health.mongo;
          return (
            <span
              key={agent.key}
              className={`agent-health-dot ${ok ? "agent-ok" : health.status === "unknown" ? "agent-unknown" : "agent-down"}`}
              title={`${agent.title} ${ok ? "up" : health.status}${mongo ? ` · mongo ${mongo}` : ""}`}
            >
              <i />
              {agent.label}
            </span>
          );
        })}
      </div>
      <small>
        {isAnalyzing
          ? "Analysis in progress"
          : allOk
            ? "Agents reachable"
            : "Some agents unreachable"}
      </small>
      <div className="pipeline-steps">
        {pipeline.map((step, index) => {
          const Icon = step.icon;
          const complete = activeIndex > index || activeIndex === 4 || activeIndex === -1;
          const active = isAnalyzing && activeIndex === index;
          return (
            <div key={step.label} className={active ? "pipeline-active" : ""}>
              <span className={`pipeline-node ${complete ? "node-complete" : ""}`}>
                {active ? <LoaderCircle className="spin" size={11} /> : complete ? <Check size={11} /> : <Icon size={11} />}
              </span>
              <p>
                <strong>{step.label}</strong>
                <small>{details[index]}<em>{active ? "now" : "ready"}</em></small>
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
  positive = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  positive?: boolean;
}) {
  return (
    <article className="metric">
      <Icon size={23} strokeWidth={1.6} />
      <div><span>{label}</span><strong>{value}</strong></div>
      <small className={positive ? "positive" : ""}>{note}</small>
    </article>
  );
}

function PanelHeader({ title, action, onAction }: { title: string; action: string; onAction?: () => void }) {
  return (
    <header className="panel-heading">
      <h2>{title}</h2>
      <button onClick={onAction}>{action}<ChevronRight size={15} /></button>
    </header>
  );
}

function SpeakerRow({
  speaker,
  rank,
  selected,
  status,
  onSelect,
}: {
  speaker: DeskLead;
  rank: number;
  selected: boolean;
  status: LeadStatus;
  onSelect: () => void;
}) {
  return (
    <article className={`speaker-row ${selected ? "speaker-selected" : ""}`}>
      <button className="speaker-main" onClick={onSelect} aria-expanded={selected}>
        <span className="rank">{rank}</span>
        <span className="identity">
          <i className={`avatar avatar-${rank}`}>{initials(speaker.name)}</i>
          <span><strong>{speaker.name}</strong><small>{speaker.title || "Title unavailable"}</small></span>
        </span>
        <span className="role-company">
          <strong>{speaker.title || "Unknown role"}</strong>
          <small>{speaker.company || "Unknown company"}</small>
        </span>
        <span className="score"><strong>{speaker.score}</strong><small>Tier {speaker.tier}</small></span>
        <span className="session">
          <strong>{speaker.conference}</strong>
          <small>{speaker.session || "Session not published"}</small>
        </span>
        <span className="outreach">
          <strong>{FUNNEL_LABELS[status]}</strong>
          <small>{speaker.outreachStage === "Identified" ? "Sequence ready" : speaker.outreachStage}</small>
        </span>
        <ChevronRight className="row-arrow" size={17} />
      </button>
      {selected ? (
        <div className="speaker-evidence">
          <div>
            <span className="mini-label">Why they matter</span>
            <p>{speaker.scoreReason}</p>
          </div>
          <div>
            <span className="mini-label">Provenance</span>
            {speaker.evidence.map((evidence) => (
              <a key={`${speaker.id}-${evidence.sourceUrl}-${evidence.label}`} href={evidence.sourceUrl} target="_blank" rel="noreferrer">
                {evidence.label}<ExternalLink size={11} />
              </a>
            ))}
          </div>
          <div>
            <span className="mini-label">Explainable score</span>
            <div className="score-bars">
              <ScoreBar label="Topic" value={speaker.scoreBreakdown.topicRelevance} max={25} />
              <ScoreBar label="Role" value={speaker.scoreBreakdown.roleFit} max={20} />
              <ScoreBar label="Company" value={speaker.scoreBreakdown.companyFit} max={20} />
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <span>
      <small>{label}</small>
      <i><b style={{ width: `${(value / max) * 100}%` }} /></i>
      <em>{value}/{max}</em>
    </span>
  );
}

function SequencePanel({
  speaker,
  steps,
  draft,
  drafts,
  activeAnchor,
  onSelectAnchor,
  loading,
}: {
  speaker: Speaker | undefined;
  steps: SequenceStep[];
  draft: SequenceDraft | null;
  drafts: SequenceDraft[];
  activeAnchor: SequenceStep["anchor"];
  onSelectAnchor: (anchor: SequenceStep["anchor"]) => void;
  loading: boolean;
}) {
  if (!speaker) return null;

  return (
    <section className="panel sequence-panel" id="sequence">
      <PanelHeader title="Event-anchored sequence" action="View all sequences" />
      <div className="sequence-person">
        <span className="avatar avatar-1">{initials(speaker.name)}</span>
        <div><strong>{speaker.name}</strong><small>{speaker.company} · {speaker.conference}</small></div>
        <span className="sequence-score">{speaker.score}<small>signal</small></span>
      </div>
      <div className="sequence-line" aria-label="Outreach sequence timeline">
        {steps.map((step, index) => (
          <article
            key={step.id}
            className={`sequence-step step-${step.status.toLowerCase()} ${activeAnchor === step.anchor ? "step-active" : ""}`}
          >
            <button className="step-select" onClick={() => onSelectAnchor(step.anchor)} type="button">
              <div className="step-anchor"><span>{step.anchor}</span><small>{formatShortDate(step.scheduledFor)}</small></div>
              <span className="step-node">{step.status === "Sent" ? <Check size={12} /> : index + 1}</span>
              <div className="step-copy">
                <strong>{step.label}</strong>
                <small>{step.subject || drafts.find((d) => d.anchor === step.anchor)?.subject || "Meet in person"}</small>
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
            {loading
              ? "Generating…"
              : draft
                ? `${draft.generatedBy === "openai" ? "OpenAI" : "Template"} · ${draft.anchor}`
                : "Grounded in published session evidence"}
          </small>
        </div>
        <p>
          {draft?.body
            ? draft.body.split("\n").slice(0, 4).join(" ")
            : `“Your session on ${speaker.session?.toLowerCase() ?? "the agenda"} caught my eye…”`}
        </p>
        <button type="button" onClick={() => onSelectAnchor(activeAnchor)}>
          Review draft<ArrowRight size={14} />
        </button>
      </div>
      <footer className="sequence-footer">
        <span><i /> Draft only — no automatic sending</span>
        <strong>{steps.length} touches</strong>
      </footer>
    </section>
  );
}

function EventsPanel({
  conferences,
  selectedId,
  onSelect,
}: {
  conferences: Conference[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const focus = conferences.find((c) => c.id === selectedId) ?? conferences[0];
  const monthLabel = focus
    ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(focus.startDate))
    : "";

  return (
    <section className="panel events-panel" id="events">
      <PanelHeader title="Upcoming events" action="View all conferences" />
      <div className="event-rail">
        {conferences.map((conference) => (
          <article key={conference.id} className={conference.id === selectedId ? "event-selected" : ""}>
            <button type="button" className="event-select" onClick={() => onSelect(conference.id)}>
              <small>{formatShortDate(conference.startDate)} – {formatShortDate(conference.endDate)}</small>
              <strong>{conference.name}</strong>
              <span>{conference.city}</span>
              <div><UsersRound size={13} />{conference.speakerCount}<Target size={13} />{conference.qualifiedCount}</div>
              <em className={`status-${conference.status.toLowerCase()}`}>
                <CircleDot size={11} />
                {conference.status === "Analyzed" ? "Agenda analyzed" : conference.status}
              </em>
            </button>
          </article>
        ))}
      </div>
      <div className="calendar-strip">
        <strong>{monthLabel}</strong>
        {["29", "30", "31", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"].map((day, index) => (
          <span key={`${day}-${index}`} className={index >= 5 && index <= 7 ? "day-active" : ""}>{day}</span>
        ))}
      </div>
    </section>
  );
}

function FunnelPanel({
  funnel,
  source,
}: {
  funnel: ReturnType<typeof useSignalData>["funnel"];
  source: "api" | "local";
}) {
  const drop = funnel.dropOff;
  return (
    <section className="panel funnel-panel" id="funnel">
      <PanelHeader title="Pipeline funnel" action="View funnel" />
      <div className="funnel-meta">
        <span>Lead statuses</span>
        <span><i /> {source === "api" ? "Agent 3" : "Local"}</span>
      </div>
      <div className="funnel-chart funnel-chart-7">
        {funnel.stages.map((stage) => (
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
      <div className="funnel-dropoff">
        <span>Largest leak</span>
        <strong>
          {drop ? `${drop.fromLabel} → ${drop.toLabel}` : "No drop-off yet"}
        </strong>
        <em>{drop ? `−${drop.lost}` : "—"}</em>
        <p>
          {drop
            ? "Advance lead status on a speaker to watch conversion and drop-off recompute."
            : "Advance statuses to surface the largest funnel leak."}
        </p>
      </div>
    </section>
  );
}

function DetailDrawer({
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
            <small>{lead.title || "Unknown role"} · {lead.company || "Unknown company"}</small>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="drawer-score">
          <span>{lead.score}<small>Tier {lead.tier}</small></span>
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
          <label className="sr-only" htmlFor="lead-status">Set lead status</label>
          <select
            id="lead-status"
            value={status}
            onChange={(event) => onSetStatus(event.target.value as LeadStatus)}
          >
            {FUNNEL_STAGES.map((stage) => (
              <option key={stage} value={stage}>{FUNNEL_LABELS[stage]}</option>
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
                    <strong>{step.anchor} · {step.label}</strong>
                    <small>{formatShortDate(step.scheduledFor)} · {step.status}</small>
                  </header>
                  {draft ? (
                    <>
                      <em>{draft.subject}</em>
                      <p>{draft.body}</p>
                      <small>Grounded on: {draft.groundedOn.join(" · ") || "session evidence"}</small>
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
