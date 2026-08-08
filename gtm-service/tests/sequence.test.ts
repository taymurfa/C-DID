import { describe, expect, it } from "vitest";
import {
  attachDraftSubjects,
  draftSequenceEmails,
  generateSequence,
} from "../src/pipeline/sequence.js";

const lead = {
  id: "maya-chen",
  name: "Maya Chen",
  title: "VP Grid Delivery",
  company: "Pacific Intertie",
  conference: "GridForward",
  session: "Energizing transmission",
  topics: ["transmission", "procurement"],
  evidence: [
    {
      label: "Agenda",
      excerpt: "VP Grid Delivery keynote",
      sourceUrl: "https://example.com/agenda",
      confidence: 0.9,
    },
  ],
};

const conference = {
  name: "GridForward",
  startDate: "2026-09-15T00:00:00.000Z",
  location: "Austin, TX",
};

describe("generateSequence", () => {
  it("builds five anchors and marks past steps Sent", () => {
    const steps = generateSequence(
      lead,
      conference,
      new Date("2026-09-10T12:00:00.000Z"),
    );
    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.anchor)).toEqual([
      "T-14",
      "T-7",
      "T-2",
      "Event",
      "T+2",
    ]);
    expect(steps[0].status).toBe("Sent"); // T-14 = Sep 1
    expect(steps[1].status).toBe("Sent"); // T-7 = Sep 8
    expect(steps[2].status).toBe("Scheduled"); // T-2 = Sep 13 upcoming
    expect(steps[3].status).toBe("Opportunity");
    expect(steps[4].status).toBe("Planned");
  });
});

describe("draftSequenceEmails", () => {
  it("returns template drafts without OpenAI", async () => {
    const steps = generateSequence(lead, conference);
    const drafts = await draftSequenceEmails(lead, conference, steps);
    expect(drafts).toHaveLength(5);
    expect(drafts.every((d) => d.generatedBy === "template")).toBe(true);
    expect(drafts.every((d) => /reply STOP/i.test(d.body))).toBe(true);
    const withSubjects = attachDraftSubjects(steps, drafts);
    expect(withSubjects.every((s) => typeof s.subject === "string")).toBe(true);
  });
});
