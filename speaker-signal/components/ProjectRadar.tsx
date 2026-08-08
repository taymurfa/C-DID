"use client";

import {
  ArrowRight,
  Check,
  CircleDot,
  Database,
  ExternalLink,
  FileText,
  Filter,
  Layers3,
  Link2,
  LoaderCircle,
  MailPlus,
  MapPin,
  Menu,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { speakers } from "@/lib/demo-data";
import { demoProjects, projectRadarSourceCount } from "@/lib/project-radar-data";
import {
  PROJECT_STAGES,
  type Project,
  type ProjectRefreshResponse,
  type ProjectSourceType,
  type ProjectStage,
} from "@/lib/project-radar";

type ProjectRadarProps = {
  onOpenSpeaker: (speakerId: string) => void;
  onOpenNavigation: () => void;
};

const SOURCE_TYPES: ProjectSourceType[] = [
  "ERCOT",
  "PUCT",
  "FERC",
  "TCEQ",
  "County agenda",
  "Equipment",
  "Finance",
  "News",
];

const STAGE_INDEX = new Map(PROJECT_STAGES.map((stage, index) => [stage, index]));

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

function initials(name: string): string {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2);
}

export function ProjectRadar({ onOpenSpeaker, onOpenNavigation }: ProjectRadarProps) {
  const [projects, setProjects] = useState<Project[]>(demoProjects);
  const [selectedId, setSelectedId] = useState(demoProjects[0].id);
  const [stageFilter, setStageFilter] = useState<ProjectStage | "All">("All");
  const [sourceFilter, setSourceFilter] = useState<ProjectSourceType | "All">("All");
  const [stateFilter, setStateFilter] = useState("Texas");
  const [confidenceFilter, setConfidenceFilter] = useState<"All" | "High" | "Medium">("All");
  const [demoMode, setDemoMode] = useState(true);
  const [sourceUrls, setSourceUrls] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sourceCount, setSourceCount] = useState(projectRadarSourceCount);
  const [refreshedAt, setRefreshedAt] = useState(new Date().toISOString());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const filteredProjects = useMemo(() => projects.filter((project) => {
    if (stageFilter !== "All" && project.stage !== stageFilter) return false;
    if (stateFilter !== "All" && project.state !== stateFilter) return false;
    if (sourceFilter !== "All" && !project.evidence.some((item) => item.sourceType === sourceFilter)) return false;
    if (confidenceFilter === "High" && project.stageConfidence < 0.85) return false;
    if (confidenceFilter === "Medium" && (project.stageConfidence < 0.65 || project.stageConfidence >= 0.85)) return false;
    return true;
  }), [projects, stageFilter, stateFilter, sourceFilter, confidenceFilter]);

  const selected = filteredProjects.find((project) => project.id === selectedId)
    ?? filteredProjects[0]
    ?? projects.find((project) => project.id === selectedId)
    ?? projects[0];
  const matchedSpeaker = speakers.find((speaker) => speaker.company === selected?.company) ?? null;
  const earlyStageCount = projects.filter((project) => (STAGE_INDEX.get(project.stage) ?? 0) <= 3).length;
  const stageChangeCount = projects.filter((project) => project.stageChanged).length;

  async function refreshProjects() {
    setIsRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const urls = sourceUrls.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean);
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoMode ? { demoMode: true } : { demoMode: false, sourceUrls: urls }),
      });
      const payload = (await response.json()) as ProjectRefreshResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Project refresh failed.");
      setProjects(payload.projects);
      setSourceCount(payload.sourceCount);
      setRefreshedAt(payload.refreshedAt);
      if (payload.projects[0]) setSelectedId(payload.projects[0].id);
      setNotice(`${payload.projects.length} projects resolved from ${payload.sourceCount} source${payload.sourceCount === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project refresh failed.");
    } finally {
      setIsRefreshing(false);
    }
  }

  function clearFilters() {
    setStageFilter("All");
    setSourceFilter("All");
    setStateFilter("Texas");
    setConfidenceFilter("All");
  }

  if (!selected) {
    return <section className="project-workspace"><p>No projects are available.</p></section>;
  }

  return (
    <section className="project-workspace" id="project-radar">
      <header className="project-command-bar">
        <button className="menu-button project-menu-button" onClick={onOpenNavigation} aria-label="Open navigation"><Menu size={20} /></button>
        <div>
          <h1>Project Radar</h1>
          <span><i /> All systems operational · refreshed {formatTime(refreshedAt)}</span>
        </div>
        {!demoMode ? (
          <label className="project-source-field">
            <Link2 size={16} />
            <span className="sr-only">Public source URLs</span>
            <input
              value={sourceUrls}
              onChange={(event) => setSourceUrls(event.target.value)}
              placeholder="Paste up to 8 public source URLs"
            />
            {sourceUrls ? <button onClick={() => setSourceUrls("")} aria-label="Clear source URLs"><X size={15} /></button> : null}
          </label>
        ) : <div className="project-live-status"><CircleDot size={15} /> Stable fixture · full entity-resolution flow</div>}
        <button
          className="project-refresh-button"
          onClick={refreshProjects}
          disabled={isRefreshing || (!demoMode && !sourceUrls.trim())}
        >
          {isRefreshing ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
          {isRefreshing ? "Refreshing" : "Run refresh"}
        </button>
        <button
          className="project-mode-button"
          onClick={() => {
            setDemoMode((value) => !value);
            setNotice(null);
            setError(null);
          }}
          aria-pressed={demoMode}
        >
          <Database size={15} />{demoMode ? "Demo data" : "Live sources"}
        </button>
      </header>

      <div className="project-filter-bar" aria-label="Project filters">
        <ProjectSelect label="Stage" value={stageFilter} onChange={(value) => setStageFilter(value as ProjectStage | "All")} options={["All", ...PROJECT_STAGES]} />
        <ProjectSelect label="Source" value={sourceFilter} onChange={(value) => setSourceFilter(value as ProjectSourceType | "All")} options={["All", ...SOURCE_TYPES]} />
        <ProjectSelect label="State" value={stateFilter} onChange={setStateFilter} options={["All", "Texas", "Unknown"]} />
        <ProjectSelect label="Confidence" value={confidenceFilter} onChange={(value) => setConfidenceFilter(value as "All" | "High" | "Medium")} options={["All", "High", "Medium"]} />
        <button onClick={clearFilters}><Filter size={14} />Clear filters</button>
      </div>

      {notice || error ? (
        <div className={`project-notice ${error ? "project-notice-error" : ""}`} role="status">
          {error ? <CircleDot size={15} /> : <Check size={15} />}
          <span>{error || notice}</span>
          <button onClick={() => { setNotice(null); setError(null); }} aria-label="Dismiss"><X size={14} /></button>
        </div>
      ) : null}

      <section className="project-metric-strip" aria-label="Project Radar metrics">
        <ProjectMetric icon={Target} label="Active projects" value={projects.length} note={`${filteredProjects.length} in current view`} />
        <ProjectMetric icon={MapPin} label="Early-stage targets" value={earlyStageCount} note="Concept through FEED" />
        <ProjectMetric icon={TrendingUp} label="Stage changes" value={stageChangeCount} note="New evidence this cycle" />
        <ProjectMetric icon={Database} label="Sources monitored" value={sourceCount} note="Public records only" />
      </section>

      <div className="project-radar-grid">
        <section className="project-panel project-map-panel">
          <header><h2>Texas project map</h2><span>{filteredProjects.length} visible</span></header>
          <div className="project-map-canvas">
            <div className="project-map-legend"><i className="marker-early" />Early <i className="marker-mid" />Mid-stage <i className="marker-advanced" />Advanced</div>
            {filteredProjects.map((project) => {
              const stageIndex = STAGE_INDEX.get(project.stage) ?? 0;
              const stageClass = stageIndex <= 2 ? "marker-early" : stageIndex <= 4 ? "marker-mid" : "marker-advanced";
              return (
                <button
                  key={project.id}
                  className={`project-marker ${stageClass} ${selected.id === project.id ? "marker-selected" : ""}`}
                  style={{ left: `${project.coordinates.x}%`, top: `${project.coordinates.y}%` }}
                  onClick={() => setSelectedId(project.id)}
                  aria-label={`Select ${project.name}`}
                  title={`${project.name} · ${project.stage}`}
                ><span /></button>
              );
            })}
            <div className="project-map-controls" aria-hidden="true"><span>+</span><span>−</span><span><Layers3 size={14} /></span></div>
          </div>
        </section>

        <section className="project-panel project-detail-panel">
          <header className="project-detail-heading">
            <div><span>Selected project</span><h2>{selected.name}</h2><a href={selected.evidence[0]?.sourceUrl} target="_blank" rel="noreferrer">{selected.company}<ExternalLink size={11} /></a></div>
            <strong>{selected.score}<small>signal</small></strong>
          </header>
          <div className="project-facts">
            <span><small>Capacity</small><strong>{selected.capacityMw ? `${selected.capacityMw.toLocaleString()} MW` : "Unknown"}</strong></span>
            <span><small>County, state</small><strong>{selected.county}, {selected.state}</strong></span>
            <span><small>Inferred stage</small><strong className="project-accent">{selected.stage}</strong></span>
            <span><small>Confidence</small><strong className="project-positive">{Math.round(selected.stageConfidence * 100)}%</strong></span>
            <span><small>Source evidence</small><strong>{selected.evidence.length}</strong></span>
            <span><small>Latest signal</small><strong>{selected.latestSignal}</strong></span>
          </div>
          <div className="project-stage-block">
            <span>Stage progression</span>
            <div className="project-stage-rail">
              {PROJECT_STAGES.map((stage, index) => {
                const selectedIndex = STAGE_INDEX.get(selected.stage) ?? 0;
                return (
                  <div key={stage} className={index < selectedIndex ? "stage-complete" : index === selectedIndex ? "stage-current" : ""}>
                    <i>{index < selectedIndex ? <Check size={10} /> : null}</i><span>{stage}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="project-evidence-block">
            <div className="project-section-title"><span>Cross-source evidence timeline</span><strong>{selected.evidence.length} records</strong></div>
            <div className="project-evidence-list">
              {selected.evidence.slice(0, 7).map((item) => (
                <a key={item.id} href={item.sourceUrl} target="_blank" rel="noreferrer">
                  <i><FileText size={13} /></i>
                  <span><strong>{item.sourceType}</strong><small>{item.title}</small></span>
                  <em>{item.sourceName}</em>
                  <time>{formatDate(item.observedAt)}</time>
                  <b className={`confidence-${item.confidence.toLowerCase()}`}>{item.confidence}</b>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="project-panel project-ranking-panel">
          <header><h2>Ranked projects</h2><span>{filteredProjects.length} projects</span></header>
          <div className="project-ranking-head"><span>#</span><span>Project</span><span>Stage</span><span>Score</span></div>
          <div className="project-ranking-list">
            {filteredProjects.map((project, index) => (
              <button key={project.id} onClick={() => setSelectedId(project.id)} className={selected.id === project.id ? "project-rank-selected" : ""}>
                <span>{index + 1}</span>
                <span><strong>{project.name}</strong><small>{project.company}</small></span>
                <span>{project.stage}</span>
                <strong>{project.score}</strong>
              </button>
            ))}
            {!filteredProjects.length ? <p>No projects match these filters.</p> : null}
          </div>
        </section>
      </div>

      <section className="project-panel combined-opportunity" id="combined-signals">
        <header><h2>Right person, right project, right moment</h2><span>Combined Track 1 + Track 2 signal</span></header>
        {matchedSpeaker ? (
          <div className="combined-opportunity-row">
            <div><small>Project company</small><strong>{selected.company}</strong><span>{selected.projectType} · {selected.capacityMw?.toLocaleString()} MW</span></div>
            <ArrowRight size={21} />
            <div className="combined-speaker"><i>{initials(matchedSpeaker.name)}</i><span><small>Upcoming speaker match</small><strong>{matchedSpeaker.name}</strong><em>{matchedSpeaker.title}</em></span></div>
            <div><small>Event and session</small><strong>{matchedSpeaker.conference}</strong><span>{matchedSpeaker.session}</span></div>
            <div className="combined-score"><small>Speaker score</small><strong>{matchedSpeaker.score}</strong></div>
            <div className="combined-actions">
              <button onClick={() => setActionNotice(`Intro request drafted for ${matchedSpeaker.name}.`)}><MailPlus size={14} />Request intro</button>
              <button onClick={() => { setActionNotice(`${matchedSpeaker.name} added to the event sequence.`); onOpenSpeaker(matchedSpeaker.id); }}><UsersRound size={14} />Open speaker</button>
            </div>
          </div>
        ) : (
          <div className="combined-empty"><Sparkles size={20} /><span>No upcoming speaker is resolved to {selected.company} yet. Project evidence remains available for account research.</span></div>
        )}
        {actionNotice ? <div className="combined-action-notice" role="status"><Check size={13} />{actionNotice}<button onClick={() => setActionNotice(null)} aria-label="Dismiss"><X size={13} /></button></div> : null}
      </section>

      <footer className="project-data-footer">
        <span>Showing {filteredProjects.length} projects</span><i />
        <span>Data as of {formatDate(refreshedAt)}</span><i />
        <span>Sources: ERCOT, PUCT, FERC, TCEQ, county agendas, equipment, finance, and news</span>
      </footer>
    </section>
  );
}

function ProjectSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option === "All" ? `All ${label.toLowerCase()}s` : option}</option>)}</select></label>
  );
}

function ProjectMetric({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: number; note: string }) {
  return <article><Icon size={25} /><span><small>{label}</small><strong>{value}</strong><em>{note}</em></span></article>;
}
