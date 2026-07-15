import { describe, it, expect } from "vitest";
import { calculateConfidence } from "@/lib/risk/confidence-engine";
import type { ConfidenceSourceInput } from "@/types";

const live = (over: Partial<ConfidenceSourceInput>): ConfidenceSourceInput => ({
  name: "src",
  reliability: 1,
  status: "LIVE",
  ageSeconds: 0,
  expectedFreshnessSeconds: 300,
  geographicRelevance: 1,
  ...over,
});

describe("confidence engine", () => {
  it("is not simply 100 - risk: derived from source quality", () => {
    const r = calculateConfidence({
      sources: [
        live({ name: "weather", reliability: 1 }),
        live({ name: "vessels", reliability: 0.8 }),
      ],
      agreement: 0.9,
    });
    // mean(100, 80) = 90; availability 1; agreement 0.9 => 81
    expect(r.score).toBe(81);
    expect(r.class).toBe("High");
    expect(r.availableFeeds).toBe(2);
    expect(r.totalFeeds).toBe(2);
  });

  it("lowers confidence and flags the failed feed when a source is unavailable", () => {
    const r = calculateConfidence({
      sources: [
        live({ name: "weather" }),
        live({ name: "marine", status: "UNAVAILABLE" }),
      ],
      agreement: 1,
    });
    expect(r.unavailableFeeds).toEqual(["marine"]);
    expect(r.availableFeeds).toBe(1);
    // mean(100)=100; availability 1/2=0.5; agreement 1 => 50
    expect(r.score).toBe(50);
    expect(r.mainLimitation).toContain("marine");
  });

  it("handles source conflict by reducing confidence with a floored agreement", () => {
    const r = calculateConfidence({
      sources: [live({ name: "weather" }), live({ name: "vessels" })],
      agreement: 0.2, // floored to 0.6
    });
    // mean(100,100)=100; availability 1; agreement floored 0.6 => 60
    expect(r.score).toBe(60);
    expect(r.class).toBe("Medium");
    expect(r.mainLimitation.toLowerCase()).toContain("disagree");
  });

  it("returns zero confidence when there are no sources", () => {
    const r = calculateConfidence({ sources: [], agreement: 1 });
    expect(r.score).toBe(0);
    expect(r.class).toBe("Low");
  });
});
