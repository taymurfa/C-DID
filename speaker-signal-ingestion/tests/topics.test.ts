import { describe, expect, it } from "vitest";
import { deriveTopics } from "../src/agent/signals.js";

describe("deriveTopics", () => {
  it("derives canonical energy/infrastructure topic tags", () => {
    const topics = deriveTopics(
      "AI data centers: power, grid interconnection and behind-the-meter generation",
    );
    expect(topics).toEqual(
      expect.arrayContaining([
        "power",
        "ai",
        "data centers",
        "grid",
        "interconnection",
        "behind-the-meter",
        "generation",
      ]),
    );
  });

  it("canonicalizes surface forms to one tag and dedupes", () => {
    const topics = deriveTopics("datacenter and data center utility utilities");
    expect(topics.filter((t) => t === "data centers")).toHaveLength(1);
    expect(topics.filter((t) => t === "utilities")).toHaveLength(1);
  });

  it("returns an empty array when no known themes are present", () => {
    expect(deriveTopics("a friendly talk about kittens and coffee")).toEqual([]);
  });

  it("does not match theme words inside unrelated words (word boundary)", () => {
    // "aid" should not match the "ai" tag.
    expect(deriveTopics("first aid training")).not.toContain("ai");
  });
});
