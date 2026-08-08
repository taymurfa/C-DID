import { describe, expect, it } from "vitest";
import { assessSeniority } from "../src/score/seniority.js";

describe("assessSeniority", () => {
  it("ranks C-level highest with full buying influence", () => {
    const cto = assessSeniority("CTO");
    expect(cto.level).toBe("c_level");
    expect(cto.buyingInfluence).toBe(1);
  });

  it("classifies VP / Head of as senior decision makers", () => {
    expect(assessSeniority("VP of Engineering").level).toBe("vp");
    expect(assessSeniority("Head of Grid Strategy").level).toBe("vp");
  });

  it("classifies directors and managers below VPs", () => {
    expect(assessSeniority("Director of Data Centers").level).toBe("director");
    expect(assessSeniority("Engineering Manager").level).toBe("manager");
  });

  it("classifies individual contributors as practitioners", () => {
    const eng = assessSeniority("Software Engineer");
    expect(eng.level).toBe("practitioner");
    expect(eng.buyingInfluence).toBeLessThan(0.5);
  });

  it("gives a neutral-low baseline for unknown titles", () => {
    const unknown = assessSeniority(null);
    expect(unknown.level).toBe("unknown");
    expect(unknown.seniorityScore).toBeLessThan(0.4);
  });

  it("orders seniority C-level > VP > director > manager > practitioner", () => {
    const c = assessSeniority("CEO").seniorityScore;
    const v = assessSeniority("SVP").seniorityScore;
    const d = assessSeniority("Director").seniorityScore;
    const m = assessSeniority("Manager").seniorityScore;
    const p = assessSeniority("Analyst").seniorityScore;
    expect(c).toBeGreaterThan(v);
    expect(v).toBeGreaterThan(d);
    expect(d).toBeGreaterThan(m);
    expect(m).toBeGreaterThan(p);
  });
});
