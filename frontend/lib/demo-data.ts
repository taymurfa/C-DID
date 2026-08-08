import type { Conference, SequenceStep, Speaker } from "./contracts";

/** Desk starts empty — live ingest/qualify fills these. */
export const speakers: Speaker[] = [];

export const conferences: Conference[] = [];

export const sequenceSteps: SequenceStep[] = [];

export const funnel = [
  { label: "Identified", value: 0 },
  { label: "Contacted", value: 0 },
  { label: "Replied", value: 0 },
  { label: "Meeting scheduled", value: 0 },
  { label: "Met", value: 0 },
  { label: "Conversation booked", value: 0 },
];
