"use client";

import {
  Activity,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  CircleDot,
  Clock3,
  Code2,
  ExternalLink,
  GitBranch,
  Link2,
  List,
  LoaderCircle,
  MapPin,
  Play,
  Search,
  Sparkles,
  Target,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { Conference, LeadStatus } from "@/lib/contracts";
import { type DeskLead, type SystemHealth, useSignalData } from "@/lib/useSignalData";
import { DESK_OPERATOR } from "@/lib/desk-profile";
import { DeskUiProvider, useDeskUi } from "@/components/desk/DeskShell";
import { CompaniesView } from "@/components/desk/CompaniesView";
import { FunnelView } from "@/components/desk/FunnelView";
import { SequencesView } from "@/components/desk/SequencesView";

export type SignalPage =
  | "calendar"
  | "connections"
  | "agent"
  | "profile";

export const SIGNAL_PAGES: { page: SignalPage; label: string }[] = [
  { page: "calendar", label: "Calendar" },
  { page: "connections", label: "Contacts" },
  { page: "agent", label: "Agent" },
  { page: "profile", label: "Profile" },
];

const pageLabels: Record<SignalPage, string> = Object.fromEntries(
  SIGNAL_PAGES.map(({ page, label }) => [page, label]),
) as Record<SignalPage, string>;

const pipeline = [
  { label: "Crawl", detail: "Agent 1", icon: Link2 },
  { label: "Extract", detail: "Agent 1", icon: Search },
  { label: "Resolve", detail: "Agent 2", icon: GitBranch },
  { label: "Score", detail: "Agent 2", icon: Target },
];

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("");
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", options).format(new Date(value));
}

function eventDateRange(conference: Conference) {
  return `${formatDate(conference.startDate)} – ${formatDate(conference.endDate, { month: "short", day: "numeric", year: "numeric" })}`;
}

function nullable(value: string | null | undefined, fallback = "—") {
  return value || fallback;
}

export function SignalDesk({ activePage: controlledPage, onPageChange }: { activePage?: SignalPage; onPageChange?: (page: SignalPage) => void }) {
  return (
    <DeskUiProvider>
      <SignalDeskInner activePage={controlledPage} onPageChange={onPageChange} />
    </DeskUiProvider>
  );
}

function SignalDeskInner({ activePage: controlledPage, onPageChange }: { activePage?: SignalPage; onPageChange?: (page: SignalPage) => void }) {
  const data = useSignalData();
  const { openSpeaker } = useDeskUi();
  const [uncontrolledPage, setUncontrolledPage] = useState<SignalPage>("calendar");
  const [drawerConference, setDrawerConference] = useState<Conference | null>(null);
  const activePage = controlledPage ?? uncontrolledPage;

  function navigate(page: SignalPage) {
    onPageChange?.(page);
    if (!onPageChange) setUncontrolledPage(page);
  }

  function openConference(conference: Conference) {
    data.selectConference(conference.id);
    setDrawerConference(conference);
  }

  function selectConference(conference: Conference) {
    data.selectConference(conference.id);
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="Signal Desk workspace">
        <header className="workspace-header">
          <div><h1>{pageLabels[activePage]}</h1></div>
          {activePage === "connections" ? <span className="header-count"><UsersRound size={16} />{data.filteredLeads.length} contacts</span> : null}
          {activePage === "agent" ? <span className="header-count agent-live"><span className={data.systemHealth.status === "ok" ? "" : "health-degraded"} />{data.systemHealth.status === "ok" ? "Systems online" : "System check"}</span> : null}
        </header>

        {activePage === "calendar" ? <CalendarPage conferences={data.conferences} speakers={data.leads} selectedConference={data.selectedConference} onSelectConference={selectConference} onOpenConference={openConference} /> : null}
        {activePage === "connections" ? <ConnectionsPage speakers={data.filteredLeads} selected={data.selected} selectedId={data.selectedId} statuses={data.statuses} onSelect={data.setSelectedId} onAdvance={data.advanceStatus} onOpenSpeaker={openSpeaker} onOpenSequences={() => navigate("agent")} /> : null}
        {activePage === "agent" ? <AgentPage data={data} /> : null}
        {activePage === "profile" ? <ProfilePage /> : null}
      </section>
      {drawerConference ? <EventDrawer conference={drawerConference} speakers={data.leads} onClose={() => setDrawerConference(null)} onOpenSpeaker={openSpeaker} /> : null}
    </main>
  );
}

function CalendarPage({ conferences, speakers, selectedConference, onSelectConference, onOpenConference }: { conferences: Conference[]; speakers: DeskLead[]; selectedConference: Conference | null; onSelectConference: (conference: Conference) => void; onOpenConference: (conference: Conference) => void }) {
  const [calendarView, setCalendarView] = useState<"calendar" | "list">("calendar");
  const [visibleMonth, setVisibleMonth] = useState(() => selectedConference?.startDate.slice(0, 7) ?? new Date().toISOString().slice(0, 7));

  function selectEvent(conference: Conference) {
    setVisibleMonth(conference.startDate.slice(0, 7));
    onSelectConference(conference);
  }

  return <div className="signal-page calendar-page">
    <div className="calendar-page-controls"><CalendarModeToggle calendarView={calendarView} onChange={setCalendarView} /></div>
    {calendarView === "calendar" ? <div className="calendar-split"><CalendarGrid conferences={conferences} selectedConference={selectedConference} visibleMonth={visibleMonth} onMonthChange={setVisibleMonth} onSelectConference={selectEvent} />{selectedConference ? <EventDescription conference={selectedConference} speakers={speakers} onOpen={() => onOpenConference(selectedConference)} /> : <CalendarEmptyDetail />}</div> : null}
    {calendarView === "list" ? <div className="calendar-list-view"><EventList conferences={conferences} speakers={speakers} onSelectConference={onOpenConference} /></div> : null}
  </div>;
}

function CalendarModeToggle({ calendarView, onChange }: { calendarView: "calendar" | "list"; onChange: (view: "calendar" | "list") => void }) {
  return <div className="calendar-view-toggle" role="group" aria-label="Calendar display"><button className={calendarView === "calendar" ? "calendar-view-active" : ""} onClick={() => onChange("calendar")} aria-pressed={calendarView === "calendar"}><CalendarDays size={15} /><span>Calendar</span></button><button className={calendarView === "list" ? "calendar-view-active" : ""} onClick={() => onChange("list")} aria-pressed={calendarView === "list"}><List size={15} /><span>List</span></button></div>;
}

function CalendarGrid({ conferences, selectedConference, visibleMonth, onMonthChange, onSelectConference }: { conferences: Conference[]; selectedConference: Conference | null; visibleMonth: string; onMonthChange: (month: string) => void; onSelectConference: (conference: Conference) => void }) {
  function shiftMonth(offset: number) {
    const [year, month] = visibleMonth.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    onMonthChange(next.toISOString().slice(0, 7));
  }

  return <section className="calendar-board panel" aria-label="Event calendar">
    {[visibleMonth].map((key) => {
      const [year, monthIndex] = key.split("-").map(Number);
      const firstDay = new Date(Date.UTC(year, monthIndex - 1, 1)).getUTCDay();
      const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
      const events = new Map<number, Conference[]>();
      conferences.filter((conference) => conference.startDate.startsWith(key)).forEach((conference) => {
        const day = new Date(conference.startDate).getUTCDate();
        events.set(day, [...(events.get(day) ?? []), conference]);
      });
      return <section className="month-calendar" key={key}><div className="calendar-month-heading"><div className="month-navigation"><button onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button><h3>{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, monthIndex - 1, 1)))}</h3><button onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button></div></div><div className="calendar-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{Array.from({ length: firstDay }, (_, index) => <span className="calendar-empty" key={`empty-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const dayEvents = events.get(day) ?? []; return <div className={dayEvents.length ? "calendar-day calendar-day-event" : "calendar-day"} key={day}><span>{day}</span>{dayEvents.map((conference) => <button className={conference.id === selectedConference?.id ? "calendar-event-selected" : ""} key={conference.id} onClick={() => onSelectConference(conference)} aria-pressed={conference.id === selectedConference?.id}><i className={`status-${conference.status.toLowerCase()}`} />{conference.name}</button>)}</div>; })}</div></section>;
    })}
  </section>;
}

function CalendarEmptyDetail() {
  return <aside className="calendar-detail calendar-empty-detail panel" aria-live="polite"><CalendarDays size={24} /><div><span className="mini-label">No events loaded</span><h2>Your event details will appear here.</h2><p>Run a conference scan from Agent to populate this calendar.</p></div></aside>;
}

function EventDescription({ conference, speakers, onOpen }: { conference: Conference; speakers: DeskLead[]; onOpen: () => void }) {
  const attendees = speakers.filter((speaker) => speaker.conference === conference.name);
  const overview = attendees.length ? `${attendees.length} high-signal attendees have been matched to this event, with ${conference.qualifiedCount} qualified for outreach.` : `${conference.speakerCount} public speakers are being tracked for qualification and outreach.`;
  return <aside className="calendar-detail panel" aria-live="polite" aria-label={`Details for ${conference.name}`}><div className="calendar-detail-head"><span className={`event-status status-${conference.status.toLowerCase()}`}><CircleDot size={12} />{conference.status === "Analyzed" ? "Ready" : conference.status}</span><h2>{conference.name}</h2><p>{eventDateRange(conference)}</p></div><div className="calendar-detail-meta"><span><MapPin size={16} />{conference.city}</span><span><UsersRound size={16} />{conference.speakerCount} speakers</span><span><Target size={16} />{conference.qualifiedCount} qualified</span></div><div className="calendar-detail-copy"><span className="mini-label">Event overview</span><p>{overview}</p></div><div className="calendar-detail-attendees"><div><span className="mini-label">People in Signal Desk</span><strong>{attendees.length} attendees</strong></div><div className="avatar-stack" aria-hidden="true">{attendees.slice(0, 5).map((speaker, index) => <i className={`avatar avatar-${(index % 5) + 1}`} key={speaker.id}>{initials(speaker.name)}</i>)}</div></div><div className="calendar-detail-actions"><button className="detail-action" onClick={onOpen}><UsersRound size={16} />View attendees</button><a href={conference.sourceUrl} target="_blank" rel="noreferrer">Event source <ExternalLink size={14} /></a></div></aside>;
}

function EventList({ conferences, speakers, onSelectConference }: { conferences: Conference[]; speakers: DeskLead[]; onSelectConference: (conference: Conference) => void }) {
  return <section className="event-grid" aria-label="Conferences">{conferences.map((conference) => {
    const attendees = speakers.filter((speaker) => speaker.conference === conference.name);
    return <article className="event-card panel" key={conference.id}><div className="event-card-top"><span className={`event-status status-${conference.status.toLowerCase()}`}><CircleDot size={12} />{conference.status === "Analyzed" ? "Ready" : conference.status}</span><span>{eventDateRange(conference)}</span></div><h3>{conference.name}</h3><p className="event-location">{conference.city}</p><div className="event-card-metrics"><span><UsersRound size={14} />{conference.speakerCount} speakers</span><span><Target size={14} />{conference.qualifiedCount} qualified</span></div><div className="event-attendee-preview"><div className="avatar-stack" aria-hidden="true">{attendees.slice(0, 3).map((speaker, index) => <i className={`avatar avatar-${index + 1}`} key={speaker.id}>{initials(speaker.name)}</i>)}</div></div><button onClick={() => onSelectConference(conference)}>View attendees <ChevronRight size={16} /></button></article>;
  })}</section>;
}

function ConnectionsPage({ speakers, selected, selectedId, statuses, onSelect, onAdvance, onOpenSpeaker, onOpenSequences }: { speakers: DeskLead[]; selected?: DeskLead; selectedId: string; statuses: Record<string, LeadStatus>; onSelect: (id: string) => void; onAdvance: (id: string) => void; onOpenSpeaker: (id: string) => void; onOpenSequences: () => void }) {
  const [query, setQuery] = useState("");
  const [contactView, setContactView] = useState<"people" | "companies">("people");
  const visibleSpeakers = speakers.filter((speaker) => `${speaker.name} ${speaker.title} ${speaker.company} ${speaker.conference}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="signal-page connections-page"><section className="connections-toolbar panel"><div className="contact-view-toggle" role="group" aria-label="Contact type"><button type="button" className={contactView === "people" ? "contact-view-active" : ""} aria-pressed={contactView === "people"} onClick={() => setContactView("people")}>People</button><button type="button" className={contactView === "companies" ? "contact-view-active" : ""} aria-pressed={contactView === "companies"} onClick={() => setContactView("companies")}>Companies</button></div>{contactView === "people" ? <label className="connection-search"><Search size={17} /><span className="sr-only">Search people</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people, companies, or events" /></label> : null}</section>{contactView === "people" ? <div className="connections-layout"><section className="connections-list panel" aria-label="High-signal people"><div className="connections-list-head"><span>Person</span><span>Signal</span><span>Event</span></div>{visibleSpeakers.map((speaker, index) => <ConnectionRow key={speaker.id} speaker={speaker} index={index} selected={speaker.id === selectedId} onSelect={() => onSelect(speaker.id)} />)}{!visibleSpeakers.length ? <div className="empty-connection">No people match that search.</div> : null}</section>{selected ? <ConnectionDetail speaker={selected} status={statuses[selected.id] ?? "identified"} onAdvance={() => onAdvance(selected.id)} onOpenSpeaker={() => onOpenSpeaker(selected.id)} onOpenSequences={onOpenSequences} /> : null}</div> : <CompaniesView />}</div>;
}

function ConnectionRow({ speaker, index, selected, onSelect }: { speaker: DeskLead; index: number; selected: boolean; onSelect: () => void }) {
  return <button className={`connection-row ${selected ? "connection-selected" : ""}`} onClick={onSelect} aria-pressed={selected}><span className="identity"><i className={`avatar avatar-${(index % 5) + 1}`}>{initials(speaker.name)}</i><span><strong>{speaker.name}</strong><small>{nullable(speaker.title)}</small><small>{nullable(speaker.company)}</small></span></span><span className="connection-score"><strong>{speaker.score}</strong><small>Tier {speaker.tier}</small></span><span className="connection-event"><strong>{speaker.conference}</strong><small>{nullable(speaker.session, "Attending")}</small></span><ChevronRight size={16} /></button>;
}

function ConnectionDetail({ speaker, status, onAdvance, onOpenSpeaker, onOpenSequences }: { speaker: DeskLead; status: LeadStatus; onAdvance: () => void; onOpenSpeaker: () => void; onOpenSequences: () => void }) {
  const sources = speaker.evidence.slice(0, 3);
  return <aside className="connection-detail panel" aria-label={`Details for ${speaker.name}`}><div className="detail-person"><i className="avatar avatar-1">{initials(speaker.name)}</i><div><h2>{speaker.name}</h2><p>{nullable(speaker.title)} · {nullable(speaker.company)}</p></div><span className="detail-score">{speaker.score}<small>signal</small></span></div><div className="detail-section"><span className="mini-label">Signal</span><p>{speaker.scoreReason}</p></div><div className="detail-section event-association"><span className="mini-label">Attending</span><CalendarDays size={17} /><div><strong>{speaker.conference}</strong><small>{nullable(speaker.session, "Session not published")}</small></div></div>{speaker.topics?.length ? <div className="detail-section"><span className="mini-label">Topics</span><p>{speaker.topics.join(" · ")}</p></div> : null}<div className="detail-section"><span className="mini-label">Score evidence</span><ScoreBar label="Topic" value={speaker.scoreBreakdown.topicRelevance} max={25} /><ScoreBar label="Role" value={speaker.scoreBreakdown.roleFit} max={20} /><ScoreBar label="Company" value={speaker.scoreBreakdown.companyFit} max={20} /></div><div className="detail-section"><span className="mini-label">Sources</span>{sources.map((source) => <a key={source.sourceUrl} href={source.sourceUrl} target="_blank" rel="noreferrer">{source.label}<span>{Math.round(source.confidence * 100)}%</span><ExternalLink size={12} /></a>)}</div><div className="detail-actions"><button className="detail-action" onClick={onAdvance}><Sparkles size={16} />Advance · {status}</button><button className="detail-action detail-action-secondary" onClick={onOpenSpeaker}><UsersRound size={16} />Open drawer</button><button className="detail-action detail-action-secondary" onClick={onOpenSequences}><Target size={16} />Sequences</button></div></aside>;
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="detail-score-bar"><span>{label}</span><i><b style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></i><em>{value}/{max}</em></div>;
}

function AgentPage({ data }: { data: ReturnType<typeof useSignalData> }) {
  const health = data.systemHealth;
  const qualified = data.stats?.qualified ?? data.leads.length;
  return <div className="signal-page agent-page"><SequencesView /><FunnelView /><section className="agent-command panel"><div><h2>Run scan</h2></div><div className="agent-command-controls"><label className="url-field"><Link2 size={17} /><span className="sr-only">Conference URL</span><input value={data.url} onChange={(event) => data.setUrl(event.target.value)} placeholder="https://… public conference or agenda URL" />{data.url ? <button onClick={() => data.setUrl("")} aria-label="Clear URL"><X size={16} /></button> : null}</label><button className="analyze-button" disabled={data.isAnalyzing} onClick={data.analyzeConference}>{data.isAnalyzing ? <LoaderCircle className="spin" size={17} /> : <Play size={17} fill="currentColor" />}{data.isAnalyzing ? pipeline[Math.min(data.pipelineIndex, 3)]?.label || "Analyzing" : "Run scan"}</button><button className="header-action" onClick={data.discoverConferences} disabled={data.isAnalyzing}>Discover</button></div></section>{data.notice || data.error ? <div className={`analysis-notice ${data.error ? "notice-error" : ""}`} role="status">{data.error ? <CircleDot size={16} /> : <CheckCircle2 size={16} />}<span>{data.error || data.notice?.message}</span>{data.notice ? <small>{data.notice.mode.toUpperCase()} · {data.notice.qualified} qualified</small> : null}<button onClick={data.dismissNotice} aria-label="Dismiss"><X size={15} /></button></div> : null}<section className="agent-health-grid" aria-label="Agent health"><AgentMetric icon={Activity} label="System" value={health.status} /><AgentMetric icon={UsersRound} label="Qualified" value={String(qualified)} /><AgentMetric icon={Clock3} label="Sequences" value={String(data.activeSequences)} /><AgentMetric icon={Code2} label="Meetings" value={String(data.meetingsBooked)} /></section><div className="agent-layout"><section className="agent-run panel"><div className="agent-panel-heading"><div><h2>Pipeline</h2></div><span className={data.isAnalyzing ? "run-status running" : "run-status"}><i />{data.isAnalyzing ? "Running" : "Ready"}</span></div><div className="agent-pipeline">{pipeline.map((step, index) => { const Icon = step.icon; const active = data.isAnalyzing && data.pipelineIndex === index; const complete = !data.isAnalyzing && data.pipelineIndex >= index; return <article key={step.label} className={active ? "agent-step active" : "agent-step"}><span>{active ? <LoaderCircle className="spin" size={15} /> : complete ? <Check size={15} /> : <Icon size={15} />}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div><em>{active ? "Now" : complete ? "Done" : "Queued"}</em></article>; })}</div></section><AgentSystems health={health} /></div><section className="agent-log panel"><div className="agent-panel-heading"><div><h2>Service status</h2></div><span className="header-count">{data.funnelSource} funnel</span></div><div className="log-table" role="table" aria-label="Agent service status"><div className="log-head" role="row"><span>Service</span><span>State</span><span>Storage</span><span>Endpoint</span></div>{Object.entries(health.agents).map(([name, agent]) => <div className="log-row" key={name} role="row"><span>{name}</span><span className={`log-level ${agent.status === "ok" ? "info" : agent.status === "down" ? "warn" : ""}`}>{agent.status}</span><span>{agent.mongo ?? "—"}</span><span>{agent.service}</span></div>)}</div></section></div>;
}

function AgentSystems({ health }: { health: SystemHealth }) {
  return <section className="agent-meta panel"><h2>Runtime details</h2><dl>{Object.entries(health.agents).map(([name, agent]) => <div key={name}><dt>{name}</dt><dd>{agent.status}</dd></div>)}<div><dt>Funnel</dt><dd>Agent 3</dd></div></dl></section>;
}

function AgentMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <article className="agent-metric panel"><Icon size={20} /><span>{label}</span><strong>{value}</strong></article>;
}

function ProfilePage() {
  const data = useSignalData();
  const mail = data.mailStatus;
  const canSend = Boolean(mail?.canSendDemo);
  const modeLabel = canSend
    ? "Real SMTP · manual demo send only"
    : "Draft only · no automatic sending";

  return (
    <div className="signal-page profile-page">
      <section className="profile-hero panel">
        <span className="profile-large-avatar">{DESK_OPERATOR.initials}</span>
        <div>
          <h2>{DESK_OPERATOR.name}</h2>
          <p>
            {DESK_OPERATOR.title} · {DESK_OPERATOR.company}
          </p>
        </div>
      </section>
      <div className="profile-grid">
        <section className="profile-section panel">
          <h2>Outreach identity</h2>
          <p>From-line used on sequence drafts. Demo sends never email the lead.</p>
          <dl>
            <div>
              <dt>From name</dt>
              <dd>{DESK_OPERATOR.name}</dd>
            </div>
            <div>
              <dt>From email</dt>
              <dd>{data.mailStatus?.senderEmail || "info@jobersteadt.com"}</dd>
            </div>
            <div>
              <dt>Company</dt>
              <dd>{DESK_OPERATOR.company}</dd>
            </div>
            <div>
              <dt>Send mode</dt>
              <dd>{modeLabel}</dd>
            </div>
          </dl>
        </section>
        <section className="profile-section panel">
          <h2>Demo recipient</h2>
          <p>
            Manual “Send demo” delivers to the team inbox ({data.teamInbox}) — not the speaker.
          </p>
          <dl>
            <div>
              <dt>Team inbox</dt>
              <dd>{data.teamInbox}</dd>
            </div>
            <div>
              <dt>SMTP host</dt>
              <dd>{mail?.smtpHost || "—"}</dd>
            </div>
            <div>
              <dt>SMTP ready</dt>
              <dd>{mail?.smtpConfigured ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </section>
        <section className="profile-section panel">
          <h2>Research preferences</h2>
          <dl>
            <div>
              <dt>Primary focus</dt>
              <dd>{DESK_OPERATOR.focus}</dd>
            </div>
            <div>
              <dt>Markets</dt>
              <dd>{DESK_OPERATOR.markets}</dd>
            </div>
            <div>
              <dt>Minimum signal score</dt>
              <dd>{DESK_OPERATOR.minScore}</dd>
            </div>
          </dl>
        </section>
        <section className="profile-section panel">
          <h2>Notifications</h2>
          <div className="preference-row">
            <span>
              <strong>New high-signal people</strong>
              <small>When Agent 2 qualifies ICP speakers</small>
            </span>
            <i className="preference-enabled" aria-label="Enabled" />
          </div>
          <div className="preference-row">
            <span>
              <strong>Agent review queue</strong>
              <small>Pipeline health and failed runs</small>
            </span>
            <i className="preference-enabled" aria-label="Enabled" />
          </div>
        </section>
      </div>
    </div>
  );
}

function EventDrawer({ conference, speakers, onClose, onOpenSpeaker }: { conference: Conference; speakers: DeskLead[]; onClose: () => void; onOpenSpeaker: (id: string) => void }) {
  const drawerRef = useRef<HTMLElement>(null);
  const attendees = speakers.filter((speaker) => speaker.conference === conference.name);
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", closeOnEscape); drawerRef.current?.focus(); return () => window.removeEventListener("keydown", closeOnEscape); }, [onClose]);
  return <div className="event-drawer-backdrop" role="presentation" onMouseDown={onClose}><aside className="event-drawer" ref={drawerRef as RefObject<HTMLElement>} role="dialog" aria-modal="true" aria-labelledby="event-drawer-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}><header><div><span className={`event-status status-${conference.status.toLowerCase()}`}><CircleDot size={12} />{conference.status === "Analyzed" ? "Ready" : conference.status}</span><h2 id="event-drawer-title">{conference.name}</h2><p>{eventDateRange(conference)} · {conference.city}</p></div><button onClick={onClose} aria-label="Close event details"><X size={19} /></button></header><div className="drawer-stats"><span><strong>{conference.speakerCount}</strong>public speakers</span><span><strong>{conference.qualifiedCount}</strong>qualified</span><span><strong>{attendees.length}</strong>in Signal Desk</span></div><section><div className="drawer-section-heading"><div><span className="eyebrow"><UsersRound size={14} />Attendees</span><h3>People to know</h3></div><a href={conference.sourceUrl} target="_blank" rel="noreferrer">Event source<ExternalLink size={13} /></a></div>{attendees.length ? <div className="drawer-attendees">{attendees.map((speaker, index) => <button type="button" className="drawer-attendee-button" key={speaker.id} onClick={() => { onOpenSpeaker(speaker.id); onClose(); }}><i className={`avatar avatar-${(index % 5) + 1}`}>{initials(speaker.name)}</i><div><strong>{speaker.name}</strong><small>{nullable(speaker.title)} · {nullable(speaker.company)}</small><p>{nullable(speaker.session, "Attending")}</p></div><span>{speaker.score}<small>signal</small></span></button>)}</div> : <div className="drawer-empty"><UsersRound size={22} /><strong>No high-signal attendees yet</strong></div>}</section><footer><button className="drawer-secondary" onClick={onClose}>Close</button></footer></aside></div>;
}
