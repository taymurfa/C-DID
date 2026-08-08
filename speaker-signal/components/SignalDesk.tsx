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
import { useMemo, useState } from "react";
import type { AnalyzeResponse, Speaker } from "@/lib/contracts";
import { conferences, funnel, sequenceSteps, speakers as seedSpeakers } from "@/lib/demo-data";

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
  { label: "Crawl", detail: "128 pages", icon: Link2 },
  { label: "Extract", detail: "842 claims", icon: Search },
  { label: "Resolve", detail: "617 entities", icon: GitBranch },
  { label: "Score", detail: "25 qualified", icon: Target },
];

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("");
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

export function SignalDesk() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [selectedId, setSelectedId] = useState(seedSpeakers[0].id);
  const [showAll, setShowAll] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [url, setUrl] = useState("https://conference-example.com/agenda");
  const [demoMode, setDemoMode] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pipelineIndex, setPipelineIndex] = useState(-1);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speakerRows, setSpeakerRows] = useState<Speaker[]>(seedSpeakers);

  const selected = useMemo(
    () => speakerRows.find((speaker) => speaker.id === selectedId) ?? speakerRows[0],
    [selectedId, speakerRows],
  );
  const visibleSpeakers = showAll ? speakerRows : speakerRows.slice(0, 3);

  function navigate(item: NavItem) {
    setActiveNav(item.label);
    setMobileNav(false);
    document.getElementById(item.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function analyzeConference() {
    setError(null);
    setResult(null);
    setIsAnalyzing(true);
    setPipelineIndex(0);

    try {
      for (let index = 0; index < pipeline.length; index += 1) {
        setPipelineIndex(index);
        await delay(320);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, demoMode }),
      });
      const payload = (await response.json()) as AnalyzeResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Analysis failed.");

      setResult(payload);
      setSelectedId(payload.speaker.id);
      setSpeakerRows((rows) => {
        const withoutDuplicate = rows.filter((speaker) => speaker.id !== payload.speaker.id);
        return [payload.speaker, ...withoutDuplicate];
      });
      document.getElementById("speakers")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setPipelineIndex(4);
      setIsAnalyzing(false);
    }
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
        <PipelineRail activeIndex={pipelineIndex} isAnalyzing={isAnalyzing} />
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
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a public conference agenda URL" />
            {url ? <button onClick={() => setUrl("")} aria-label="Clear URL"><X size={16} /></button> : null}
          </label>
          <button className="analyze-button" disabled={isAnalyzing || !url} onClick={analyzeConference}>
            {isAnalyzing ? <LoaderCircle className="spin" size={17} /> : <Play size={17} fill="currentColor" />}
            {isAnalyzing ? pipeline[Math.min(pipelineIndex, 3)]?.label || "Analyzing" : "Analyze conference"}
          </button>
          <button className="mode-button" onClick={() => setDemoMode((value) => !value)} aria-pressed={demoMode}>
            <Database size={16} />
            {demoMode ? "Demo data" : "Live Firecrawl"}
            <ChevronDown size={15} />
          </button>
        </header>

        {result || error ? (
          <div className={`analysis-notice ${error ? "notice-error" : ""}`} role="status">
            {error ? <CircleDot size={16} /> : <CheckCircle2 size={16} />}
            <span>{error || result?.message}</span>
            {result && <small>{result.mode.toUpperCase()} · {result.pagesProcessed} page · {result.entitiesExtracted} signals</small>}
            <button onClick={() => { setResult(null); setError(null); }} aria-label="Dismiss"><X size={15} /></button>
          </div>
        ) : null}

        <section className="metric-strip" aria-label="Key metrics">
          <Metric icon={CalendarDays} label="Upcoming conferences" value="4" note="Next: GridForward Summit" />
          <Metric icon={UsersRound} label="Qualified speakers" value="25" note="↑ 6 vs last 7 days" positive />
          <Metric icon={Send} label="Active sequences" value="18" note="3 paused" />
          <Metric icon={Target} label="Meetings booked" value="6" note="↑ 2 vs last 7 days" positive />
        </section>

        <div className="primary-grid">
          <section className="panel speakers-panel" id="speakers">
            <PanelHeader title="High-signal speakers" action="View all speakers" onAction={() => setShowAll((value) => !value)} />
            <div className="speaker-head" aria-hidden="true">
              <span>#</span><span>Speaker</span><span>Role / company</span><span>Score</span><span>Conference / session</span><span>Outreach</span>
            </div>
            <div className="speaker-list">
              {visibleSpeakers.map((speaker, index) => (
                <SpeakerRow key={speaker.id} speaker={speaker} rank={index + 1} selected={speaker.id === selectedId} onSelect={() => setSelectedId(speaker.id)} />
              ))}
            </div>
            <footer className="panel-footer">
              <button onClick={() => setShowAll((value) => !value)}>{showAll ? "Show top 3" : "View all 25 speakers"}<ChevronRight size={15} /></button>
              <span>{showAll ? speakerRows.length : Math.min(3, speakerRows.length)} shown · 25 qualified</span>
            </footer>
          </section>

          <SequencePanel speaker={selected} />
        </div>

        <div className="secondary-grid">
          <EventsPanel />
          <FunnelPanel />
        </div>
      </section>
    </main>
  );
}

function PipelineRail({ activeIndex, isAnalyzing }: { activeIndex: number; isAnalyzing: boolean }) {
  return (
    <section className="pipeline-rail" id="pipeline">
      <div className="pipeline-title"><span>Pipeline health</span><i className={isAnalyzing ? "dot-live" : ""} /></div>
      <small>{isAnalyzing ? "Analysis in progress" : "All systems normal"}</small>
      <div className="pipeline-steps">
        {pipeline.map((step, index) => {
          const Icon = step.icon;
          const complete = activeIndex > index || activeIndex === 4 || activeIndex === -1;
          const active = isAnalyzing && activeIndex === index;
          return (
            <div key={step.label} className={active ? "pipeline-active" : ""}>
              <span className={`pipeline-node ${complete ? "node-complete" : ""}`}>{active ? <LoaderCircle className="spin" size={11} /> : complete ? <Check size={11} /> : <Icon size={11} />}</span>
              <p><strong>{step.label}</strong><small>{step.detail}<em>{active ? "now" : "2m ago"}</em></small></p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, note, positive = false }: { icon: LucideIcon; label: string; value: string; note: string; positive?: boolean }) {
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

function SpeakerRow({ speaker, rank, selected, onSelect }: { speaker: Speaker; rank: number; selected: boolean; onSelect: () => void }) {
  return (
    <article className={`speaker-row ${selected ? "speaker-selected" : ""}`}>
      <button className="speaker-main" onClick={onSelect} aria-expanded={selected}>
        <span className="rank">{rank}</span>
        <span className="identity"><i className={`avatar avatar-${rank}`}>{initials(speaker.name)}</i><span><strong>{speaker.name}</strong><small>{speaker.title || "Title unavailable"}</small></span></span>
        <span className="role-company"><strong>{speaker.title || "Unknown role"}</strong><small>{speaker.company || "Unknown company"}</small></span>
        <span className="score"><strong>{speaker.score}</strong><small>Tier {speaker.tier}</small></span>
        <span className="session"><strong>{speaker.conference}</strong><small>{speaker.session || "Session not published"}</small></span>
        <span className="outreach"><strong>{speaker.outreachStage}</strong><small>{speaker.outreachStage === "Identified" ? "Not contacted" : "Sequence active"}</small></span>
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
              <a key={`${speaker.id}-${evidence.sourceUrl}`} href={evidence.sourceUrl} target="_blank" rel="noreferrer">
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
  return <span><small>{label}</small><i><b style={{ width: `${(value / max) * 100}%` }} /></i><em>{value}/{max}</em></span>;
}

function SequencePanel({ speaker }: { speaker: Speaker }) {
  return (
    <section className="panel sequence-panel" id="sequence">
      <PanelHeader title="Event-anchored sequence" action="View all sequences" />
      <div className="sequence-person">
        <span className="avatar avatar-1">{initials(speaker.name)}</span>
        <div><strong>{speaker.name}</strong><small>{speaker.company} · {speaker.conference}</small></div>
        <span className="sequence-score">{speaker.score}<small>signal</small></span>
      </div>
      <div className="sequence-line" aria-label="Outreach sequence timeline">
        {sequenceSteps.map((step, index) => (
          <article key={step.id} className={`sequence-step step-${step.status.toLowerCase()}`}>
            <div className="step-anchor"><span>{step.anchor}</span><small>{formatShortDate(step.scheduledFor)}</small></div>
            <span className="step-node">{step.status === "Sent" ? <Check size={12} /> : index + 1}</span>
            <div className="step-copy"><strong>{step.label}</strong><small>{step.subject || "Meet in person"}</small><em>{step.status}</em></div>
          </article>
        ))}
      </div>
      <div className="draft-card">
        <div><Sparkles size={15} /><span>Personalized draft</span><small>Grounded in published session evidence</small></div>
        <p>“Your session on {speaker.session?.toLowerCase()} caught my eye. We’re seeing owners compress the same delivery constraints…”</p>
        <button>Review draft<ArrowRight size={14} /></button>
      </div>
      <footer className="sequence-footer"><span><i /> Draft only — no automatic sending</span><strong>5 touches</strong></footer>
    </section>
  );
}

function EventsPanel() {
  return (
    <section className="panel events-panel" id="events">
      <PanelHeader title="Upcoming events" action="View all conferences" />
      <div className="event-rail">
        {conferences.map((conference, index) => (
          <article key={conference.id} className={index === 0 ? "event-selected" : ""}>
            <small>{formatShortDate(conference.startDate)} – {formatShortDate(conference.endDate)}</small>
            <strong>{conference.name}</strong>
            <span>{conference.city}</span>
            <div><UsersRound size={13} />{conference.speakerCount}<Target size={13} />{conference.qualifiedCount}</div>
            <em className={`status-${conference.status.toLowerCase()}`}><CircleDot size={11} />{conference.status === "Analyzed" ? "Agenda analyzed" : conference.status}</em>
          </article>
        ))}
      </div>
      <div className="calendar-strip">
        <strong>Sep 2026</strong>
        {["29", "30", "31", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"].map((day, index) => <span key={`${day}-${index}`} className={index >= 5 && index <= 7 ? "day-active" : ""}>{day}</span>)}
      </div>
    </section>
  );
}

function FunnelPanel() {
  return (
    <section className="panel funnel-panel" id="funnel">
      <PanelHeader title="Pipeline funnel" action="View funnel" />
      <div className="funnel-meta"><span>Last 30 days</span><span><i /> Updated 2m ago</span></div>
      <div className="funnel-chart">
        {funnel.map((stage, index) => {
          const conversion = index === 0 ? null : Math.round((stage.value / funnel[index - 1].value) * 100);
          return (
            <div key={stage.label} className="funnel-stage">
              <span>{stage.label}</span>
              <strong>{stage.value}</strong>
              <small>{conversion ? `${conversion}% from prior` : "Source set"}</small>
            </div>
          );
        })}
      </div>
      <div className="funnel-dropoff">
        <span>Largest leak</span>
        <strong>Identified → Contacted</strong>
        <em>−386</em>
        <p>Sequence capacity, not reply quality, is the current constraint.</p>
      </div>
    </section>
  );
}
