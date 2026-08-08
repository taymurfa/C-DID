"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  conferences as seedConferences,
  sequenceSteps as seedSequenceSteps,
  speakers as seedSpeakers,
} from "@/lib/demo-data";
import { computeFunnel, nextLeadStatus } from "@/lib/pipeline/funnel";

export type DeskLead = Speaker &
  Partial<Pick<QualifiedLead, "topics" | "role" | "isICP" | "rank">>;

export type QualifyNotice = {
  mode: "live" | "demo";
  message: string;
  speakersIngested: number;
  qualified: number;
};

type SequenceConferencePayload = {
  name: string | null;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  websiteUrl?: string;
};

const SEED_STATUSES: Record<string, LeadStatus> = {
  "maya-chen": "replied",
  "marcus-reed": "contacted",
  "elena-torres": "meeting",
  "darius-okafor": "identified",
  "priya-shah": "identified",
};

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
  return null;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useSignalData() {
  const [url, setUrl] = useState("https://conference-example.com/agenda");
  const [demoMode, setDemoMode] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pipelineIndex, setPipelineIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<QualifyNotice | null>(null);

  const [leads, setLeads] = useState<DeskLead[]>(seedSpeakers);
  const [statuses, setStatuses] = useState<Record<string, LeadStatus>>(() => ({
    ...SEED_STATUSES,
  }));
  const [conferences, setConferences] = useState<Conference[]>(seedConferences);
  const [selectedConferenceId, setSelectedConferenceId] = useState<string | null>(
    seedConferences[0]?.id ?? null,
  );
  const [selectedId, setSelectedId] = useState(seedSpeakers[0]?.id ?? "");
  const [stats, setStats] = useState<QualifyResponse["stats"] | null>(null);
  const [qualifyConference, setQualifyConference] = useState<
    QualifyResponse["conference"] | null
  >(null);

  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>(seedSequenceSteps);
  const [drafts, setDrafts] = useState<SequenceDraft[]>([]);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [activeDraftAnchor, setActiveDraftAnchor] =
    useState<SequenceStep["anchor"]>("T-14");

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

  // Derive selection from filter — no syncing effect needed.
  const selected = useMemo(() => {
    return (
      filteredLeads.find((lead) => lead.id === selectedId) ??
      filteredLeads[0] ??
      leads[0]
    );
  }, [filteredLeads, selectedId, leads]);

  const funnel: Funnel = useMemo(
    () =>
      computeFunnel(
        leads.map((lead) => ({
          status: statuses[lead.id] ?? "identified",
        })),
      ),
    [leads, statuses],
  );

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

  // Fetch sequence + drafts when selected lead / conference changes.
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
      } catch {
        // Keep last good sequence; do not block the desk.
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
    setIsAnalyzing(true);
    setPipelineIndex(0);

    try {
      for (let index = 0; index < 4; index += 1) {
        setPipelineIndex(index);
        await delay(320);
      }

      const body = demoMode
        ? { demoMode: true }
        : { conferenceUrl: url, demoMode: false };

      const response = await fetch("/api/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as QualifyResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Qualification failed.");

      setLeads(payload.leads);
      setStats(payload.stats);
      setQualifyConference(payload.conference);

      const nextStatuses: Record<string, LeadStatus> = {};
      for (const lead of payload.leads) nextStatuses[lead.id] = "identified";
      setStatuses(nextStatuses);

      const confId = "analyzed";
      const startDate = toIsoDate(
        payload.conference.startDate,
        seedConferences[0].startDate,
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
      setConferences([
        analyzed,
        ...seedConferences.filter((c) => c.name !== analyzed.name),
      ]);
      setSelectedConferenceId(confId);

      if (payload.leads[0]) setSelectedId(payload.leads[0].id);

      setNotice({
        mode: payload.mode,
        message: `Qualified ${payload.stats.qualified} speakers from ${payload.stats.speakersIngested} ingested (${payload.stats.afterDedupe} after dedupe).`,
        speakersIngested: payload.stats.speakersIngested,
        qualified: payload.stats.qualified,
      });

      document
        .getElementById("speakers")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Qualification failed.");
    } finally {
      setPipelineIndex(4);
      setIsAnalyzing(false);
    }
  }, [demoMode, url]);

  const advanceStatus = useCallback((leadId: string) => {
    setStatuses((prev) => {
      const current = prev[leadId] ?? "identified";
      const next = nextLeadStatus(current);
      if (!next) return prev;
      return { ...prev, [leadId]: next };
    });
  }, []);

  const setLeadStatus = useCallback((leadId: string, status: LeadStatus) => {
    setStatuses((prev) => ({ ...prev, [leadId]: status }));
  }, []);

  const selectConference = useCallback(
    (id: string) => {
      setSelectedConferenceId(id);
      const conference = conferences.find((c) => c.id === id);
      if (!conference) return;
      const matching = leads.filter((lead) => lead.conference === conference.name);
      const pool = matching.length > 0 ? matching : leads;
      if (pool[0]) setSelectedId(pool[0].id);
    },
    [conferences, leads],
  );

  const dismissNotice = useCallback(() => {
    setNotice(null);
    setError(null);
  }, []);

  const activeDraft = useMemo(
    () => drafts.find((d) => d.anchor === activeDraftAnchor) ?? drafts[0] ?? null,
    [drafts, activeDraftAnchor],
  );

  return {
    url,
    setUrl,
    demoMode,
    setDemoMode,
    isAnalyzing,
    pipelineIndex,
    error,
    notice,
    dismissNotice,
    analyzeConference,
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
    meetingsBooked,
    activeSequences,
    sequenceSteps,
    drafts,
    activeDraft,
    activeDraftAnchor,
    setActiveDraftAnchor,
    sequenceLoading,
  };
}
