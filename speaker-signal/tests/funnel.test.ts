import { describe, expect, it } from "vitest";
import { computeFunnel, nextLeadStatus, previousLeadStatus } from "@/lib/pipeline/funnel";
import type { LeadStatus } from "@/lib/contracts";

describe("computeFunnel", () => {
  it("rolls leads into all prior stages with conversion and drop-off", () => {
    const leads: { status: LeadStatus }[] = [
      { status: "identified" },
      { status: "identified" },
      { status: "contacted" },
      { status: "contacted" },
      { status: "replied" },
      { status: "meeting" },
      { status: "booked" },
    ];

    const funnel = computeFunnel(leads);

    expect(funnel.stages.map((s) => s.stage)).toEqual([
      "identified",
      "contacted",
      "replied",
      "meeting",
      "met",
      "follow-up",
      "booked",
    ]);

    // Classic roll-up: booked counts in every prior stage
    expect(funnel.stages.map((s) => s.count)).toEqual([7, 5, 3, 2, 1, 1, 1]);

    expect(funnel.stages[0].conversionFromPrior).toBeNull();
    expect(funnel.stages[1].conversionFromPrior).toBe(71); // 5/7
    expect(funnel.stages[2].conversionFromPrior).toBe(60); // 3/5

    // Largest absolute leak is identified → contacted (2 lost)
    expect(funnel.dropOff).toEqual({
      from: "identified",
      to: "contacted",
      fromLabel: "Identified",
      toLabel: "Contacted",
      lost: 2,
    });
  });

  it("returns null dropOff when every lead is at the same stage", () => {
    const funnel = computeFunnel([
      { status: "identified" },
      { status: "identified" },
    ]);
    expect(funnel.stages[0].count).toBe(2);
    expect(funnel.stages[1].count).toBe(0);
    expect(funnel.dropOff?.lost).toBe(2);
  });

  it("handles an empty lead set", () => {
    const funnel = computeFunnel([]);
    expect(funnel.stages.every((s) => s.count === 0)).toBe(true);
    expect(funnel.dropOff).toBeNull();
  });
});

describe("status helpers", () => {
  it("advances and retreats along the funnel", () => {
    expect(nextLeadStatus("identified")).toBe("contacted");
    expect(nextLeadStatus("booked")).toBeNull();
    expect(previousLeadStatus("booked")).toBe("follow-up");
    expect(previousLeadStatus("identified")).toBeNull();
  });
});
