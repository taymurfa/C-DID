"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Conference,
  Funnel,
  LeadStatus,
  QualifiedLead,
  QualifyResponse,
  SequenceDraft,
  SequenceStep,
  Speaker,
} from "@/lib/contracts";
import { computeFunnel, nextLeadStatus } from "@/lib/pipeline/funnel";
import {
  DEFAULT_DEMO_INBOX,
  resolveTeamInbox,
  type MailStatus,
} from "@/lib/desk-profile";

export type AgentHealthDot = {
  service: string;
  status: "ok" | "down" | "unknown";
  mongo?: string;
};

export type SystemHealth = {
  status: "ok" | "degraded" | "unknown";
  agents: {
    ingestion: AgentHealthDot;
    intelligence: AgentHealthDot;
    gtm: AgentHealthDot;
  };
};

const UNKNOWN_AGENT = (service: string): AgentHealthDot => ({
  service,
  status: "unknown",
});

export type DeskLead = Speaker &
  Partial<
    Pick<QualifiedLead, "topics" | "role" | "isICP" | "rank" | "normalizedCompany">
  >;

function stampDemoRecipientEmail(
  leads: DeskLead[],
  teamInbox: string,
): DeskLead[] {
  return leads.map((lead) => ({
    ...lead,
    email: lead.email ?? teamInbox,
  }));
}

export type QualifyNotice = {
  mode: "live" | "demo";
  message: string;
  speakersIngested: number;
  qualified: number;
  degraded?: boolean;
};

type SequenceConferencePayload = {
  name: string | null;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  websiteUrl?: string;
};

const DEFAULT_LIVE_URL = "https://www.7x24exchange.org/";

function toIsoDate(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function conferencePayloadFrom(
  conference: Conference | null,
  qualifyConference: QualifyResponse["conference"] | null,
): SequenceConferencePayload | null {
  if (qualifyConference?.startDate) {
    return {
      name: qualifyConference.name,
      startDate: toIsoDate(qualifyConference.startDate, qualifyConference.startDate),
      endDate: qualifyConference.endDate,
      location: qualifyConference.location,
      websiteUrl: qualifyConference.websiteUrl,
    };
  }
  if (conference) {
    return {
      name: conference.name,
      startDate: conference.startDate,
      endDate: conference.endDate,
      location: conference.city,
      websiteUrl: conference.sourceUrl,
    };
  }
  if (qualifyConference?.websiteUrl) {
    const fallbackStart = new Date().toISOString();
    return {
      name: qualifyConference.name,
      startDate: fallbackStart,
      endDate: qualifyConference.endDate,
      location: qualifyConference.location,
      websiteUrl: qualifyConference.websiteUrl,
    };
  }
  return null;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function postFunnelEvent(
  leadId: string,
  status: LeadStatus,
  conferenceName?: string | null,
) {
  try {
    await fetch("/api/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        status,
        conferenceName: conferenceName ?? null,
      }),
    });
  } catch {
    // Non-blocking — local funnel still updates.
  }
}

function applyQualifyPayload(
  payload: QualifyResponse,
  setters: {
    setLeads: (leads: DeskLead[]) => void;
    setStats: (stats: QualifyResponse["stats"] | null) => void;
    setQualifyConference: (c: QualifyResponse["conference"] | null) => void;
    setStatuses: (s: Record<string, LeadStatus>) => void;
    setConferences: (
      updater: Conference[] | ((prev: Conference[]) => Conference[]),
    ) => void;
    setSelectedConferenceId: (id: string | null) => void;
    setSelectedId: (id: string) => void;
  },
  options: { postEvents?: boolean; teamInbox?: string } = {},
) {
  const inbox = options.teamInbox?.trim() || DEFAULT_DEMO_INBOX;
  setters.setLeads(stampDemoRecipientEmail(payload.leads, inbox));
  setters.setStats(payload.stats);
  setters.setQualifyConference(payload.conference);

  const nextStatuses: Record<string, LeadStatus> = {};
  for (const lead of payload.leads) {
    nextStatuses[lead.id] = "identified";
    if (options.postEvents) {
      void postFunnelEvent(lead.id, "identified", payload.conference.name);
    }
  }
  setters.setStatuses(nextStatuses);

  const confId = "analyzed";
  const startDate = toIsoDate(
    payload.conference.startDate,
    new Date().toISOString(),
  );
  const endDate = toIsoDate(payload.conference.endDate, startDate);
  const analyzed: Conference = {
    id: confId,
    name: payload.conference.name ?? "Analyzed conference",
    startDate,
    endDate,
    city: payload.conference.location ?? "TBD",
    sourceUrl: payload.conference.websiteUrl,
    speakerCount: payload.stats.speakersIngested,
    qualifiedCount: payload.stats.qualified,
    status: "Analyzed",
  };
  setters.setConferences((prev) => [
    analyzed,
    ...prev.filter((c) => c.id !== confId && c.name !== analyzed.name),
  ]);
  setters.setSelectedConferenceId(confId);
  if (payload.leads[0]) setters.setSelectedId(payload.leads[0].id);
}

export type SignalDataValue = {
  url: string;
  setUrl: (url: string) => void;
  isAnalyzing: boolean;
  isPreviewing: boolean;
  pipelineIndex: number;
  error: string | null;
  notice: QualifyNotice | null;
  dismissNotice: () => void;
  analyzeConference: () => Promise<boolean>;
  previewCrawl: () => Promise<void>;
  discoverConferences: () => Promise<void>;
  leads: DeskLead[];
  filteredLeads: DeskLead[];
  selected: DeskLead | undefined;
  selectedId: string;
  setSelectedId: (id: string) => void;
  statuses: Record<string, LeadStatus>;
  advanceStatus: (leadId: string) => void;
  setLeadStatus: (leadId: string, status: LeadStatus) => void;
  conferences: Conference[];
  selectedConference: Conference | null;
  selectedConferenceId: string | null;
  selectConference: (id: string) => void;
  stats: QualifyResponse["stats"] | null;
  funnel: Funnel;
  funnelSource: "api" | "local";
  meetingsBooked: number;
  activeSequences: number;
  sequenceSteps: SequenceStep[];
  drafts: SequenceDraft[];
  activeDraft: SequenceDraft | null;
  activeDraftAnchor: SequenceStep["anchor"];
  setActiveDraftAnchor: (anchor: SequenceStep["anchor"]) => void;
  sequenceLoading: boolean;
  systemHealth: SystemHealth;
  bootstrapped: boolean;
  /** Demo send destination (TEST_TO_EMAIL). */
  teamInbox: string;
  mailStatus: MailStatus | null;
};

const SignalDataContext = createContext<SignalDataValue | null>(null);

function useSignalDataState(): SignalDataValue {
  // Desk starts empty; paste a public conference URL and Analyze to fill via Agents 1→2.
  const [url, setUrl] = useState(DEFAULT_LIVE_URL);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [pipelineIndex, setPipelineIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<QualifyNotice | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    status: "unknown",
    agents: {
      ingestion: UNKNOWN_AGENT("ingestion"),
      intelligence: UNKNOWN_AGENT("intelligence"),
      gtm: UNKNOWN_AGENT("gtm"),
    },
  });

  const [leads, setLeads] = useState<DeskLead[]>([]);
  const [statuses, setStatuses] = useState<Record<string, LeadStatus>>({});
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [selectedConferenceId, setSelectedConferenceId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [stats, setStats] = useState<QualifyResponse["stats"] | null>(null);
  const [qualifyConference, setQualifyConference] = useState<
    QualifyResponse["conference"] | null
  >(null);

  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);
  const [drafts, setDrafts] = useState<SequenceDraft[]>([]);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [sequenceError, setSequenceError] = useState<string | null>(null);
  const [activeDraftAnchor, setActiveDraftAnchor] =
    useState<SequenceStep["anchor"]>("T-14");

  const [apiFunnel, setApiFunnel] = useState<Funnel | null>(null);
  const [funnelSource, setFunnelSource] = useState<"api" | "local">("local");
  const [mailStatus, setMailStatus] = useState<MailStatus | null>(null);
  const teamInbox = resolveTeamInbox(mailStatus);

  const selectedConference = useMemo(
    () =>
      conferences.find((c) => c.id === selectedConferenceId) ??
      conferences[0] ??
      null,
    [conferences, selectedConferenceId],
  );

  const filteredLeads = useMemo(() => {
    if (!selectedConference) return leads;
    const name = selectedConference.name;
    const matching = leads.filter((lead) => lead.conference === name);
    return matching.length > 0 ? matching : leads;
  }, [leads, selectedConference]);

  const selected = useMemo(() => {
    return (
      filteredLeads.find((lead) => lead.id === selectedId) ??
      filteredLeads[0] ??
      leads[0]
    );
  }, [filteredLeads, selectedId, leads]);

  const localFunnel: Funnel = useMemo(
    () =>
      computeFunnel(
        leads.map((lead) => ({
          status: statuses[lead.id] ?? "identified",
        })),
      ),
    [leads, statuses],
  );

  const funnel = apiFunnel ?? localFunnel;

  const meetingsBooked = useMemo(
    () =>
      Object.values(statuses).filter(
        (s) => s === "booked" || s === "meeting" || s === "met",
      ).length,
    [statuses],
  );

  const activeSequences = useMemo(
    () =>
      Object.values(statuses).filter((s) => s !== "identified" && s !== "booked")
        .length,
    [statuses],
  );

  const sequenceConference = useMemo(() => {
    if (!selected) return null;
    const leadConference =
      conferences.find((c) => c.name === selected.conference) ?? selectedConference;
    const useQualify =
      qualifyConference &&
      selected.conference === (qualifyConference.name ?? selected.conference);
    return (
      conferencePayloadFrom(leadConference, useQualify ? qualifyConference : null) ??
      conferencePayloadFrom(selectedConference, qualifyConference)
    );
  }, [selected, conferences, selectedConference, qualifyConference]);

  const refreshFunnel = useCallback(async () => {
    try {
      const response = await fetch("/api/funnel", { cache: "no-store" });
      if (!response.ok) {
        setFunnelSource("local");
        return;
      }
      const payload = (await response.json()) as Funnel & {
        leadStatuses?: Record<string, LeadStatus>;
        error?: string;
      };
      if (!payload?.stages?.length) {
        setFunnelSource("local");
        return;
      }
      setApiFunnel({ stages: payload.stages, dropOff: payload.dropOff ?? null });
      setFunnelSource("api");
      if (payload.leadStatuses) {
        setStatuses((prev) => {
          const next = { ...prev };
          for (const [leadId, status] of Object.entries(payload.leadStatuses!)) {
            if (leadId in next) next[leadId] = status;
          }
          return next;
        });
      }
    } catch {
      setFunnelSource("local");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshHealth() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const payload = (await response.json()) as SystemHealth;
        if (!cancelled && payload?.agents) setSystemHealth(payload);
      } catch {
        if (!cancelled) {
          setSystemHealth({
            status: "degraded",
            agents: {
              ingestion: { service: "ingestion", status: "down" },
              intelligence: { service: "intelligence", status: "down" },
              gtm: { service: "gtm", status: "down" },
            },
          });
        }
      }
    }

    async function refreshMail() {
      try {
        const response = await fetch("/api/mail/status", { cache: "no-store" });
        const payload = (await response.json()) as MailStatus;
        if (!cancelled) setMailStatus(payload);
      } catch {
        if (!cancelled) {
          setMailStatus({
            canSendDemo: false,
            draftOnly: true,
            sendMode: "mock",
            teamInbox: null,
          });
        }
      }
    }

    void refreshHealth();
    void refreshMail();
    const timer = window.setInterval(refreshHealth, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const inbox = teamInbox;
    setLeads((prev) => {
      if (!prev.length) return prev;
      const needsStamp = prev.some((lead) => !lead.email);
      if (!needsStamp) return prev;
      return stampDemoRecipientEmail(prev, inbox);
    });
  }, [teamInbox]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      await refreshFunnel();
      if (!cancelled) setBootstrapped(true);
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected || !sequenceConference?.startDate) return;

    const lead = selected;
    const conference = {
      ...sequenceConference,
      name: sequenceConference.name ?? lead.conference,
    };

    let cancelled = false;

    async function loadSequence() {
      setSequenceLoading(true);
      setSequenceError(null);
      try {
        const response = await fetch("/api/sequence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead, conference }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Sequence failed.");
        if (cancelled) return;

        const nextSteps = (payload.steps as SequenceStep[]) ?? [];
        const nextDrafts = (payload.drafts as SequenceDraft[]) ?? [];
        setSequenceSteps(nextSteps);
        setDrafts(nextDrafts);
        const firstScheduled =
          nextSteps.find((s) => s.status === "Scheduled")?.anchor ??
          nextDrafts[0]?.anchor ??
          "T-14";
        setActiveDraftAnchor(firstScheduled);
      } catch (caught) {
        if (!cancelled) {
          setSequenceError(
            caught instanceof Error ? caught.message : "Sequence failed.",
          );
        }
      } finally {
        if (!cancelled) setSequenceLoading(false);
      }
    }

    void loadSequence();
    return () => {
      cancelled = true;
    };
  }, [selected, sequenceConference]);

  const analyzeConference = useCallback(async () => {
    setError(null);
    setNotice(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a public conference or agenda URL, then Analyze.");
      return false;
    }

    setIsAnalyzing(true);
    setPipelineIndex(0);

    try {
      for (let index = 0; index < 4; index += 1) {
        setPipelineIndex(index);
        await delay(320);
      }

      const response = await fetch("/api/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conferenceUrl: trimmed }),
      });
      const payload = (await response.json()) as QualifyResponse & {
        error?: string;
        degraded?: boolean;
        source?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Qualification failed.");

      if (!payload.leads?.length) {
        throw new Error(
          "No speakers extracted from that URL. Try another public agenda page.",
        );
      }

      applyQualifyPayload(payload, {
        setLeads,
        setStats,
        setQualifyConference,
        setStatuses,
        setConferences,
        setSelectedConferenceId,
        setSelectedId,
      }, { postEvents: true, teamInbox });

      const degradedNote = payload.degraded
        ? " Agent 2 unreachable — scored with embedded fallback."
        : payload.source === "agent2"
          ? " Scored by Agent 2."
          : "";

      setNotice({
        mode: payload.mode,
        message: `Qualified ${payload.stats.qualified} speakers from ${payload.stats.speakersIngested} ingested (${payload.stats.afterDedupe} after dedupe).${degradedNote}`,
        speakersIngested: payload.stats.speakersIngested,
        qualified: payload.stats.qualified,
        degraded: payload.degraded,
      });

      await refreshFunnel();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Qualification failed.");
      return false;
    } finally {
      setPipelineIndex(4);
      setIsAnalyzing(false);
    }
  }, [url, refreshFunnel, teamInbox]);

  const previewCrawl = useCallback(async () => {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setNotice({
        mode: "live",
        message: "Paste a public conference URL to preview a crawl.",
        speakersIngested: stats?.speakersIngested ?? 0,
        qualified: stats?.qualified ?? 0,
      });
      return;
    }
    setIsPreviewing(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, demoMode: false }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setNotice({
          mode: "live",
          message: payload.error || "Preview crawl failed — you can still run Analyze conference.",
          speakersIngested: stats?.speakersIngested ?? 0,
          qualified: stats?.qualified ?? 0,
          degraded: true,
        });
        return;
      }
      setNotice({
        mode: payload.mode === "live" ? "live" : "demo",
        message:
          payload.message ||
          `Preview ready: ${payload.pageTitle ?? "conference page"} (${payload.entitiesExtracted ?? 0} signal hits).`,
        speakersIngested: payload.pagesProcessed ?? stats?.speakersIngested ?? 0,
        qualified: stats?.qualified ?? 0,
      });
    } catch (caught) {
      setNotice({
        mode: "live",
        message:
          caught instanceof Error
            ? `${caught.message} — preview unavailable; Analyze conference still works.`
            : "Preview crawl failed — Analyze conference still works.",
        speakersIngested: stats?.speakersIngested ?? 0,
        qualified: stats?.qualified ?? 0,
        degraded: true,
      });
    } finally {
      setIsPreviewing(false);
    }
  }, [url, stats]);

  const advanceStatus = useCallback(
    (leadId: string) => {
      setStatuses((prev) => {
        const current = prev[leadId] ?? "identified";
        const next = nextLeadStatus(current);
        if (!next) return prev;
        const lead = leads.find((l) => l.id === leadId);
        void postFunnelEvent(leadId, next, lead?.conference).then(() =>
          refreshFunnel(),
        );
        setApiFunnel(null);
        setFunnelSource("local");
        return { ...prev, [leadId]: next };
      });
    },
    [leads, refreshFunnel],
  );

  const setLeadStatus = useCallback(
    (leadId: string, status: LeadStatus) => {
      const lead = leads.find((l) => l.id === leadId);
      void postFunnelEvent(leadId, status, lead?.conference).then(() =>
        refreshFunnel(),
      );
      setApiFunnel(null);
      setFunnelSource("local");
      setStatuses((prev) => ({ ...prev, [leadId]: status }));
    },
    [leads, refreshFunnel],
  );

  const selectConference = useCallback(
    (id: string) => {
      setSelectedConferenceId(id);
      const conference = conferences.find((c) => c.id === id);
      if (!conference) return;
      if (conference.sourceUrl) setUrl(conference.sourceUrl);
      const matching = leads.filter((lead) => lead.conference === conference.name);
      const pool = matching.length > 0 ? matching : leads;
      if (pool[0]) setSelectedId(pool[0].id);
    },
    [conferences, leads],
  );

  const discoverConferences = useCallback(async () => {
    setError(null);
    try {
      const seedUrls = [
        url || DEFAULT_LIVE_URL,
        "https://www.datacenterworld.com/",
        "https://infrastructuremasons.org/events/",
      ].filter((value, index, all) => all.indexOf(value) === index);

      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedUrls, maxPerSeed: 5 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Discover failed.");

      const discovered = (payload.discoveredEvents ?? []) as Array<{
        name?: string | null;
        url?: string;
        startDate?: string | null;
        endDate?: string | null;
        location?: string | null;
        confidence?: number;
      }>;

      if (!discovered.length) {
        setNotice({
          mode: "live",
          message: "Discover finished — no additional events found from those seeds.",
          speakersIngested: stats?.speakersIngested ?? 0,
          qualified: stats?.qualified ?? 0,
        });
        return;
      }

      const safeMapped: Conference[] = discovered
        .filter((event) => event.url)
        .slice(0, 12)
        .map((event, index) => {
          const startDate = toIsoDate(
            event.startDate,
            new Date().toISOString(),
          );
          let host = "event";
          try {
            host = new URL(event.url!).hostname.replace(/\W+/g, "-");
          } catch {
            host = `event-${index}`;
          }
          return {
            id: `discovered-${host}-${index}`,
            name: event.name || host,
            startDate,
            endDate: toIsoDate(event.endDate, startDate),
            city: event.location || "TBD",
            sourceUrl: event.url!,
            speakerCount: 0,
            qualifiedCount: 0,
            status: "Queued" as const,
          };
        });

      setConferences((prev) => {
        const byUrl = new Set(prev.map((c) => c.sourceUrl));
        const fresh = safeMapped.filter((c) => !byUrl.has(c.sourceUrl));
        return [...fresh, ...prev];
      });
      if (safeMapped[0]) {
        setUrl(safeMapped[0].sourceUrl);
        setSelectedConferenceId(safeMapped[0].id);
      }
      setNotice({
        mode: "live",
        message: `Discovered ${safeMapped.length} events via Agent 1.`,
        speakersIngested: stats?.speakersIngested ?? 0,
        qualified: stats?.qualified ?? 0,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Discover failed.");
    }
  }, [url, stats]);

  const dismissNotice = useCallback(() => {
    setNotice(null);
    setError(null);
    setSequenceError(null);
  }, []);

  const activeDraft = useMemo(
    () => drafts.find((d) => d.anchor === activeDraftAnchor) ?? drafts[0] ?? null,
    [drafts, activeDraftAnchor],
  );

  return {
    url,
    setUrl,
    isAnalyzing,
    isPreviewing,
    pipelineIndex,
    error: error || sequenceError,
    notice,
    dismissNotice,
    analyzeConference,
    previewCrawl,
    discoverConferences,
    leads,
    filteredLeads,
    selected,
    selectedId,
    setSelectedId,
    statuses,
    advanceStatus,
    setLeadStatus,
    conferences,
    selectedConference,
    selectedConferenceId,
    selectConference,
    stats,
    funnel,
    funnelSource,
    meetingsBooked,
    activeSequences,
    sequenceSteps,
    drafts,
    activeDraft,
    activeDraftAnchor,
    setActiveDraftAnchor,
    sequenceLoading,
    systemHealth,
    bootstrapped,
    teamInbox,
    mailStatus,
  };
}

export function SignalDataProvider({ children }: { children: ReactNode }) {
  const value = useSignalDataState();
  return (
    <SignalDataContext.Provider value={value}>{children}</SignalDataContext.Provider>
  );
}

export function useSignalData(): SignalDataValue {
  const ctx = useContext(SignalDataContext);
  if (!ctx) {
    throw new Error("useSignalData must be used within SignalDataProvider");
  }
  return ctx;
}
