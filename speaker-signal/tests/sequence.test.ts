import { describe, expect, it } from "vitest";
import { generateSequence, draftSequenceEmails } from "@/lib/pipeline/sequence";
import type { SequenceLead } from "@/lib/pipeline/sequence";

const LEAD: SequenceLead = {
  id: "maya-chen",
  name: "Maya Chen",
  title: "VP, Infrastructure Development",
  company: "HelioCore Energy",
  conference: "GridForward Summit 2026",
  session: "Behind-the-meter power for AI campuses",
  topics: ["power", "data centers"],
  evidence: [
    {
      label: "Agenda",
      excerpt: "Behind-the-meter power for AI campuses",
      sourceUrl: "https://example.com/gridforward/agenda",
      confidence: 0.98,
    },
  ],
};

const CONFERENCE = {
  name: "GridForward Summit 2026",
  startDate: "2026-09-03T14:00:00.000Z",
  endDate: "2026-09-05T22:00:00.000Z",
  location: "Austin, TX",
};

describe("generateSequence", () => {
  it("anchors T−14…T+2 to the conference start date", () => {
    const now = new Date("2026-08-25T12:00:00.000Z");
    const steps = generateSequence(LEAD, CONFERENCE, now);

    expect(steps.map((s) => s.anchor)).toEqual(["T-14", "T-7", "T-2", "Event", "T+2"]);
    expect(steps.map((s) => s.scheduledFor.slice(0, 10))).toEqual([
      "2026-08-20",
      "2026-08-27",
      "2026-09-01",
      "2026-09-03",
      "2026-09-05",
    ]);
  });

  it("marks past emails Sent, next Scheduled, later Planned, Event Opportunity", () => {
    const mid = generateSequence(LEAD, CONFERENCE, new Date("2026-08-25T12:00:00.000Z"));
    expect(mid.map((s) => [s.anchor, s.status])).toEqual([
      ["T-14", "Sent"],
      ["T-7", "Scheduled"],
      ["T-2", "Planned"],
      ["Event", "Opportunity"],
      ["T+2", "Planned"],
    ]);
  });

  it("transitions statuses as now advances past each email touch", () => {
    const afterT7 = generateSequence(LEAD, CONFERENCE, new Date("2026-08-28T00:00:00.000Z"));
    expect(afterT7.find((s) => s.anchor === "T-7")?.status).toBe("Sent");
    expect(afterT7.find((s) => s.anchor === "T-2")?.status).toBe("Scheduled");
    expect(afterT7.find((s) => s.anchor === "Event")?.status).toBe("Opportunity");

    const afterEvent = generateSequence(LEAD, CONFERENCE, new Date("2026-09-04T00:00:00.000Z"));
    expect(afterEvent.find((s) => s.anchor === "T-2")?.status).toBe("Sent");
    expect(afterEvent.find((s) => s.anchor === "T+2")?.status).toBe("Scheduled");
    expect(afterEvent.find((s) => s.anchor === "Event")?.status).toBe("Opportunity");
  });
});

describe("draftSequenceEmails (template fallback)", () => {
  it("returns deterministic, evidence-grounded drafts without OpenAI", async () => {
    expect(process.env.OPENAI_API_KEY).toBeFalsy();

    const steps = generateSequence(LEAD, CONFERENCE, new Date("2026-08-25T12:00:00.000Z"));
    const drafts = await draftSequenceEmails(LEAD, CONFERENCE, steps);

    expect(drafts).toHaveLength(5);
    expect(drafts.every((d) => d.generatedBy === "template")).toBe(true);

    for (const draft of drafts) {
      expect(draft.subject.length).toBeGreaterThan(0);
      expect(draft.body).toContain("Maya");
      expect(draft.body.toLowerCase()).toMatch(/behind-the-meter|power|data centers/);
      expect(draft.groundedOn.some((g) => /Agenda|Session:|Topic:/.test(g))).toBe(true);
    }

    const again = await draftSequenceEmails(LEAD, CONFERENCE, steps);
    expect(again).toEqual(drafts);
  });
});
