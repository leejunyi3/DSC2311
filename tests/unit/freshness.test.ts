import { describe, it, expect } from "vitest";
import {
  classifyFreshness,
  freshnessFactor,
  evaluateFreshness,
  ageSecondsFrom,
} from "@/lib/risk/freshness-engine";

const EXPECTED = 300; // 5 minutes

describe("freshness classification", () => {
  it("classifies by multiples of the expected window", () => {
    expect(classifyFreshness(100, EXPECTED)).toBe("FRESH"); // ratio 0.33
    expect(classifyFreshness(EXPECTED, EXPECTED)).toBe("FRESH"); // ratio 1.0
    expect(classifyFreshness(400, EXPECTED)).toBe("RECENT"); // ratio 1.33
    expect(classifyFreshness(700, EXPECTED)).toBe("STALE"); // ratio 2.33
    expect(classifyFreshness(1500, EXPECTED)).toBe("EXPIRED"); // ratio 5.0
  });

  it("treats invalid inputs as EXPIRED", () => {
    expect(classifyFreshness(-1, EXPECTED)).toBe("EXPIRED");
    expect(classifyFreshness(100, 0)).toBe("EXPIRED");
  });

  it("produces a decaying 0..1 factor", () => {
    expect(freshnessFactor(0, EXPECTED)).toBe(1);
    expect(freshnessFactor(600, EXPECTED)).toBeCloseTo(0.5, 5); // half of 4× span
    expect(freshnessFactor(1200, EXPECTED)).toBe(0); // at 4× expected
    expect(freshnessFactor(5000, EXPECTED)).toBe(0);
  });

  it("bundles class + factor via evaluateFreshness", () => {
    const r = evaluateFreshness(400, EXPECTED);
    expect(r.class).toBe("RECENT");
    expect(r.ageSeconds).toBe(400);
    expect(r.factor).toBeGreaterThan(0);
    expect(r.factor).toBeLessThan(1);
  });

  it("computes non-negative age between two ISO timestamps", () => {
    const age = ageSecondsFrom(
      "2026-07-15T02:00:00.000Z",
      "2026-07-15T02:05:00.000Z",
    );
    expect(age).toBe(300);
    // future observation clamps to 0 rather than going negative
    expect(
      ageSecondsFrom("2026-07-15T02:10:00.000Z", "2026-07-15T02:00:00.000Z"),
    ).toBe(0);
  });
});
