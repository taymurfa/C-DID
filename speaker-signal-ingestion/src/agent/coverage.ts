import type { Conference } from "../schemas/conference.js";
import type { Coverage } from "../schemas/coverage.js";
import type { PageType } from "../schemas/page.js";
import type { Session } from "../schemas/session.js";
import type { Speaker } from "../schemas/speaker.js";

export interface AccumulatedState {
  conference: Conference;
  sessions: Session[];
  speakers: Speaker[];
}

/** Snapshot what Agent 1 has found so far. */
export function computeCoverage(state: AccumulatedState): Coverage {
  const speakers = state.speakers;
  const sessions = state.sessions;

  return {
    hasConferenceDates: Boolean(
      state.conference.startDate || state.conference.endDate,
    ),
    hasConferenceLocation: Boolean(state.conference.location),
    hasAgenda: sessions.length > 0,
    hasSessionTitles: sessions.some((s) => s.title.trim().length > 0),
    hasSpeakerNames: speakers.some((s) => s.name.trim().length > 0),
    hasSpeakerTitles: speakers.some((s) => Boolean(s.title)),
    hasSpeakerCompanies: speakers.some((s) => Boolean(s.company)),
    hasSpeakerSessionLinks: speakers.some((s) => s.sessionSourceIds.length > 0),
  };
}

export function isCoverageComplete(coverage: Coverage): boolean {
  return Object.values(coverage).every(Boolean);
}

/**
 * Given current gaps, return the page types most likely to fill them, in
 * priority order. The frontier scorer uses this to bias the next crawl.
 */
export function desiredPageTypes(coverage: Coverage): PageType[] {
  const wanted: PageType[] = [];

  if (!coverage.hasAgenda || !coverage.hasSessionTitles) {
    wanted.push("agenda", "session");
  }
  if (!coverage.hasSpeakerNames) {
    wanted.push("speakers");
  }
  if (
    (!coverage.hasSpeakerTitles || !coverage.hasSpeakerCompanies) &&
    coverage.hasSpeakerNames
  ) {
    // Titles/companies usually live on individual speaker profile pages.
    wanted.push("profile", "speakers");
  }
  if (!coverage.hasConferenceDates || !coverage.hasConferenceLocation) {
    wanted.push("overview");
  }

  return [...new Set(wanted)];
}

/** Human-readable description of what's still missing (for prompts/logs). */
export function describeGaps(coverage: Coverage): string[] {
  const gaps: string[] = [];
  if (!coverage.hasConferenceDates) gaps.push("conference dates");
  if (!coverage.hasConferenceLocation) gaps.push("conference location");
  if (!coverage.hasAgenda) gaps.push("agenda/sessions");
  if (!coverage.hasSpeakerNames) gaps.push("speaker names");
  if (!coverage.hasSpeakerTitles) gaps.push("speaker titles");
  if (!coverage.hasSpeakerCompanies) gaps.push("speaker companies");
  if (!coverage.hasSpeakerSessionLinks) gaps.push("speaker-session links");
  return gaps;
}
