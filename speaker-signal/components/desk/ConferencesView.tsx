"use client";

import {
  CircleDot,
  LoaderCircle,
  Search,
  Target,
  UsersRound,
} from "lucide-react";
import { useMemo } from "react";
import type { Conference } from "@/lib/contracts";
import { useSignalData } from "@/lib/useSignalData";
import { formatShortDate, PanelHeader } from "@/components/desk/shared";

function buildCalendarDays(conferences: Conference[], focus: Conference | null) {
  const anchor = focus
    ? new Date(focus.startDate)
    : conferences[0]
      ? new Date(conferences[0].startDate)
      : new Date();
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 3);

  const activeDays = new Set<string>();
  for (const conference of conferences) {
    const from = new Date(conference.startDate);
    const to = new Date(conference.endDate || conference.startDate);
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    for (
      let cursor = new Date(from);
      cursor.getTime() <= to.getTime();
      cursor.setDate(cursor.getDate() + 1)
    ) {
      activeDays.add(cursor.toISOString().slice(0, 10));
    }
  }

  const days: Array<{ key: string; label: string; active: boolean }> = [];
  for (let i = 0; i < 14; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    days.push({
      key,
      label: String(day.getDate()),
      active: activeDays.has(key),
    });
  }

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(anchor);

  return { monthLabel, days };
}

export function ConferencesView() {
  const data = useSignalData();
  const focus =
    data.conferences.find((c) => c.id === data.selectedConferenceId) ??
    data.conferences[0] ??
    null;
  const calendar = useMemo(
    () => buildCalendarDays(data.conferences, focus),
    [data.conferences, focus],
  );

  return (
    <section className="panel events-panel page-panel">
      <PanelHeader title="Upcoming events" action="Select to focus analyze" />
      <div className="conference-actions">
        <button
          type="button"
          className="mode-button"
          onClick={() => void data.previewCrawl()}
          disabled={data.isPreviewing || data.isAnalyzing || !data.url}
          title="Firecrawl / scrape preview via /api/analyze"
        >
          {data.isPreviewing ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Search size={16} />
          )}
          {data.isPreviewing ? "Previewing…" : "Preview crawl"}
        </button>
        <button
          type="button"
          className="mode-button"
          onClick={() => void data.discoverConferences()}
          disabled={data.isAnalyzing}
        >
          <Search size={16} />
          Discover events
        </button>
        <small>
          Preview uses <code>/api/analyze</code> before full Analyze conference.
        </small>
      </div>

      <div className="event-rail event-rail-full">
        {data.conferences.map((conference) => (
          <article
            key={conference.id}
            className={conference.id === data.selectedConferenceId ? "event-selected" : ""}
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
              <em className={`status-${conference.status.toLowerCase()}`}>
                <CircleDot size={11} />
                {conference.status === "Analyzed" ? "Agenda analyzed" : conference.status}
              </em>
            </button>
          </article>
        ))}
      </div>

      <div className="calendar-strip">
        <strong>{calendar.monthLabel}</strong>
        {calendar.days.map((day) => (
          <span key={day.key} className={day.active ? "day-active" : ""}>
            {day.label}
          </span>
        ))}
      </div>
    </section>
  );
}
