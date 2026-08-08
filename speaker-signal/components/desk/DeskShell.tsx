"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bot,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Filter,
  Link2,
  LoaderCircle,
  Menu,
  Play,
  Radar,
  Search,
  Send,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSignalData } from "@/lib/useSignalData";
import { DESK_OPERATOR } from "@/lib/desk-profile";
import { deskHref, PIPELINE_STEPS, PipelineSteps } from "@/components/desk/shared";
import { SpeakerDrawer } from "@/components/desk/SpeakerDrawer";

type NavItem = { label: string; icon: LucideIcon; path: string };

const NAV: NavItem[] = [
  { label: "Overview", icon: Activity, path: "/" },
  { label: "Conferences", icon: CalendarDays, path: "/conferences" },
  { label: "Speakers", icon: UserRound, path: "/speakers" },
  { label: "Companies", icon: Building2, path: "/companies" },
  { label: "Sequences", icon: Send, path: "/sequences" },
  { label: "Funnel", icon: Filter, path: "/funnel" },
  { label: "Agent Runs", icon: Bot, path: "/agent-runs" },
  { label: "Project Radar", icon: Radar, path: "/projects" },
];

type DeskUiValue = {
  basePath: string;
  openSpeaker: (id: string) => void;
  openNavigation: () => void;
  closeDrawer: () => void;
};

const DeskUiContext = createContext<DeskUiValue | null>(null);

export function useDeskUi() {
  const ctx = useContext(DeskUiContext);
  if (!ctx) throw new Error("useDeskUi must be used within DeskShell");
  return ctx;
}

function normalizePath(pathname: string, basePath: string) {
  if (!basePath) return pathname || "/";
  if (pathname === basePath || pathname === `${basePath}/`) return "/";
  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length) || "/";
  }
  return pathname;
}

export function DeskShell({
  children,
  basePath = "",
}: {
  children: ReactNode;
  basePath?: string;
}) {
  const data = useSignalData();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNav, setMobileNav] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activePath = normalizePath(pathname, basePath);
  const isProjectRoute = activePath === "/projects";

  const setSelectedId = data.setSelectedId;
  const openSpeaker = useCallback(
    (id: string) => {
      setSelectedId(id);
      setDrawerOpen(true);
    },
    [setSelectedId],
  );

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openNavigation = useCallback(() => setMobileNav(true), []);

  const uiValue = useMemo(
    () => ({ basePath, openSpeaker, openNavigation, closeDrawer }),
    [basePath, openSpeaker, openNavigation, closeDrawer],
  );

  async function handleAnalyze() {
    const ok = await data.analyzeConference();
    if (ok) router.push(deskHref(basePath, "/speakers"));
  }

  return (
    <DeskUiContext.Provider value={uiValue}>
      <main className="app-shell">
        <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div>
              <strong>Candid Intelligence</strong>
              <small>Origination Desk</small>
            </div>
            <button
              className="mobile-close"
              onClick={() => setMobileNav(false)}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
          <nav aria-label="Primary navigation">
            {NAV.map((item) => {
              const Icon = item.icon;
              const href = deskHref(basePath, item.path);
              const active = activePath === item.path;
              return (
                <Link
                  key={item.label}
                  href={href}
                  className={active ? "nav-active" : ""}
                  onClick={() => setMobileNav(false)}
                >
                  <Icon size={18} strokeWidth={1.7} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <SidebarHealth
            activeIndex={data.pipelineIndex}
            isAnalyzing={data.isAnalyzing}
            stats={data.stats}
            systemHealth={data.systemHealth}
            agentRunsHref={deskHref(basePath, "/agent-runs")}
          />
          <div className="profile">
            <span className="profile-avatar">{DESK_OPERATOR.initials}</span>
            <span>
              <strong>{DESK_OPERATOR.name}</strong>
              <small>{DESK_OPERATOR.company}</small>
            </span>
            <ChevronDown size={16} />
          </div>
        </aside>

        <section className={`workspace ${isProjectRoute ? "project-workspace-shell" : ""}`}>
          {!isProjectRoute ? <header className="command-bar">
            <button
              className="menu-button"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <h1>Signal Desk</h1>
            <label className="url-field">
              <Link2 size={17} />
              <span className="sr-only">Conference URL</span>
              <input
                value={data.url}
                onChange={(event) => data.setUrl(event.target.value)}
                placeholder="https://… public conference or agenda URL"
              />
              {data.url ? (
                <button onClick={() => data.setUrl("")} aria-label="Clear URL">
                  <X size={16} />
                </button>
              ) : null}
            </label>
            <button
              className="analyze-button"
              disabled={data.isAnalyzing}
              onClick={() => void handleAnalyze()}
            >
              {data.isAnalyzing ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Play size={17} fill="currentColor" />
              )}
              {data.isAnalyzing
                ? PIPELINE_STEPS[Math.min(data.pipelineIndex, 3)]?.label || "Analyzing"
                : "Analyze conference"}
            </button>
            <button
              className="mode-button"
              onClick={() => void data.discoverConferences()}
              disabled={data.isAnalyzing}
              title="Discover events via Agent 1"
            >
              <Search size={16} />
              Discover
            </button>
          </header> : null}

          {!isProjectRoute && (data.notice || data.error) ? (
            <div
              className={`analysis-notice ${data.error ? "notice-error" : ""}`}
              role="status"
            >
              {data.error ? <CircleDot size={16} /> : <CheckCircle2 size={16} />}
              <span>{data.error || data.notice?.message}</span>
              {data.notice ? (
                <small>
                  {data.notice.mode.toUpperCase()}
                  {data.notice.degraded ? " · DEGRADED" : ""}
                  {" · "}
                  {data.notice.speakersIngested} ingested · {data.notice.qualified}{" "}
                  qualified
                </small>
              ) : null}
              <button onClick={data.dismissNotice} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          ) : null}

          {children}
        </section>

        {drawerOpen && data.selected ? (
          <SpeakerDrawer
            lead={data.selected}
            status={data.statuses[data.selected.id] ?? "identified"}
            steps={data.sequenceSteps}
            drafts={data.drafts}
            activeDraft={data.activeDraft}
            onAdvance={() => data.advanceStatus(data.selected!.id)}
            onSetStatus={(status) => data.setLeadStatus(data.selected!.id, status)}
            onClose={closeDrawer}
          />
        ) : null}
      </main>
    </DeskUiContext.Provider>
  );
}

function SidebarHealth({
  activeIndex,
  isAnalyzing,
  stats,
  systemHealth,
  agentRunsHref,
}: {
  activeIndex: number;
  isAnalyzing: boolean;
  stats: { speakersIngested: number; afterDedupe: number; qualified: number } | null;
  systemHealth: ReturnType<typeof useSignalData>["systemHealth"];
  agentRunsHref: string;
}) {
  const agents = [
    { key: "ingestion" as const, label: "Ingestion", title: "Ingestion" },
    { key: "intelligence" as const, label: "Intelligence", title: "Intelligence" },
    { key: "gtm" as const, label: "GTM", title: "GTM" },
  ];
  const allOk = systemHealth.status === "ok";

  return (
    <section className="pipeline-rail">
      <div className="pipeline-title">
        <Link href={agentRunsHref}>System health</Link>
        <i
          className={`${allOk || systemHealth.status === "unknown" ? "" : "dot-warn"} ${isAnalyzing ? "dot-live" : ""}`}
        />
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
            : systemHealth.status === "unknown"
              ? "Checking agents…"
              : "Some agents unreachable"}
      </small>
      <PipelineSteps
        activeIndex={activeIndex}
        isAnalyzing={isAnalyzing}
        stats={stats}
      />
    </section>
  );
}
