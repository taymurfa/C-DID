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

type HydratedSequence = {
  id: string;
  leadId: string;
  lead?: Record<string, unknown> | null;
  conference?: SequenceConferencePayload | null;
  steps?: SequenceStep[];
  drafts?: SequenceDraft[];
};

function tierFromScore(score: number): DeskLead["tier"] {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  return "D";
}

function scoreBreakdownFrom(score: number): DeskLead["scoreBreakdown"] {
  return {
    roleFit: Math.min(20, Math.round(score * 0.18)),
    companyFit: Math.min(20, Math.round(score * 0.18)),
    topicRelevance: Math.min(25, Math.round(score * 0.28)),
    seniority: Math.min(15, Math.round(score * 0.14)),
    buyingInfluence: Math.min(10, Math.round(score * 0.12)),
    eventProximity: Math.min(10, Math.round(score * 0.1)),
  };
}

function deskLeadFromHydrated(seq: HydratedSequence, inbox: string): DeskLead | null {
  const lead = seq.lead;
  if (!lead || typeof lead !== "object") return null;
  const id = String(lead.id || seq.leadId || "");
  const name = String(lead.name || "");
  if (!id || !name) return null;
  const score = Number(lead.score ?? 0);
  const conferenceName = String(
    lead.conference || seq.conference?.name || "Conference",
  );
  const evidenceRaw = Array.isArray(lead.evidence) ? lead.evidence : [];
  const sourceUrl =
    seq.conference?.websiteUrl || "https://www.datacenterworld.com/";

  return {
    id,
    name,
    title: (lead.title as string | null | undefined) ?? null,
    company: (lead.company as string | null | undefined) ?? null,
    conference: conferenceName,
    session: (lead.session as string | null | undefined) ?? null,
    email: (lead.email as string | null | undefined) ?? inbox,
    score,
    tier: tierFromScore(score),
    scoreReason: String(
      lead.reason ||
        lead.whyThisPersonMatters ||
        lead.scoreReason ||
        `ICP score ${score}`,
    ),
    confidence: 0.85,
    scoreBreakdown: scoreBreakdownFrom(score),
    evidence: evidenceRaw.map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        label: String(row.label || (index === 0 ? "Session" : "Signal")),
        excerpt: String(row.excerpt || row.label || ""),
        sourceUrl: String(row.sourceUrl || sourceUrl),
        confidence: Number(row.confidence ?? 0.85),
      };
    }),
    outreachStage: "Identified",
    topics: Array.isArray(lead.topics)
      ? lead.topics.map(String)
      : lead.session
        ? [String(lead.session)]
        : [],
  };
}

function conferencesFromSequences(sequences: HydratedSequence[]): Conference[] {
  const byName = new Map<string, { seq: HydratedSequence; count: number }>();
  for (const seq of sequences) {
    const name = String(seq.conference?.name || seq.lead?.conference || "").trim();
    if (!name) continue;
    const existing = byName.get(name);
    if (existing) existing.count += 1;
    else byName.set(name, { seq, count: 1 });
  }

  return [...byName.entries()].map(([name, { seq, count }]) => {
    const start =
      toIsoDate(seq.conference?.startDate, new Date().toISOString());
    const end = toIsoDate(seq.conference?.endDate, start);
    const sourceUrl =
      seq.conference?.websiteUrl || "https://www.datacenterworld.com/";
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "conference",
      name,
      startDate: start,
      endDate: end,
      city: seq.conference?.location || "Dallas, TX",
      sourceUrl,
      speakerCount: count,
      qualifiedCount: count,
      status: "Analyzed" as const,
    };
  });
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

  const [sequenceByLeadId, setSequenceByLeadId] = useState<
    Record<string, HydratedSequence>
  >({});

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
            next[leadId] = status;
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
      try {
        const response = await fetch("/api/sequences", { cache: "no-store" });
        const payload = (await response.json()) as {
          sequences?: HydratedSequence[];
        };
        const sequences = Array.isArray(payload.sequences)
          ? payload.sequences
          : [];
        if (!cancelled && sequences.length > 0) {
          const inbox = teamInbox || DEFAULT_DEMO_INBOX;
          const nextLeads = sequences
            .map((seq) => deskLeadFromHydrated(seq, inbox))
            .filter((lead): lead is DeskLead => Boolean(lead));
          const byLead: Record<string, HydratedSequence> = {};
          for (const seq of sequences) {
            if (seq.leadId) byLead[seq.leadId] = seq;
          }
          const nextConferences = conferencesFromSequences(sequences);

          if (nextLeads.length > 0) {
            setLeads(stampDemoRecipientEmail(nextLeads, inbox));
            setSequenceByLeadId(byLead);
            setStatuses((prev) => {
              const next = { ...prev };
              for (const lead of nextLeads) {
                if (!next[lead.id]) next[lead.id] = "identified";
              }
              return next;
            });
            if (nextConferences.length > 0) {
              setConferences(nextConferences);
              setSelectedConferenceId((cur) => cur ?? nextConferences[0]?.id ?? null);
            }
            setSelectedId((cur) => cur || nextLeads[0]?.id || "");
            setQualifyConference((prev) => {
              if (prev) return prev;
              const first = sequences[0]?.conference;
              if (!first?.startDate) return prev;
              return {
                name: first.name,
                startDate: first.startDate,
                endDate: first.endDate ?? null,
                location: first.location ?? null,
                websiteUrl: first.websiteUrl || "https://www.datacenterworld.com/",
              };
            });
            setNotice({
              mode: "live",
              message: `Loaded ${nextLeads.length} speakers from GTM sequences.`,
              speakersIngested: nextLeads.length,
              qualified: nextLeads.length,
            });
          }
        }
      } catch {
        // Desk can still run Analyze if GTM list is unavailable.
      }

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
    if (!selected) return;

    const cached = sequenceByLeadId[selected.id];
    if (cached?.steps?.length) {
      setSequenceSteps(cached.steps);
      setDrafts(cached.drafts ?? []);
      const firstScheduled =
        cached.steps.find((s) => s.status === "Scheduled")?.anchor ??
        cached.drafts?.[0]?.anchor ??
        "T-14";
      setActiveDraftAnchor(firstScheduled);
      setSequenceLoading(false);
      setSequenceError(null);
      return;
    }

    if (!sequenceConference?.startDate) return;

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
        setSequenceByLeadId((prev) => ({
          ...prev,
          [lead.id]: {
            id: String(payload.id || lead.id),
            leadId: lead.id,
            lead: lead as unknown as Record<string, unknown>,
            conference,
            steps: nextSteps,
            drafts: nextDrafts,
          },
        }));
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
  }, [selected, sequenceConference, sequenceByLeadId]);

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
