import { describe, it, expect } from "vitest";
import { calculateCongestion } from "@/lib/risk/congestion-engine";

describe("estimated congestion", () => {
  it("computes the weighted density/slow/stationary blend", () => {
    const r = calculateCongestion({
      vesselCount: 60,
      baselineVesselCount: 40, // density range 20..80 -> 60 => 66.67
      slowMovingCount: 12, // ratio 0.2
      stationaryCount: 6, // ratio 0.1
      averageSpeedKnots: 4,
      previousVesselCount: 50,
    });
    // 66.67*.40 + (0.2*100)*.35 + (0.1*100)*.25 = 26.67 + 7 + 2.5 = 36.17
    expect(r.normalisedDensity).toBeCloseTo(66.67, 1);
    expect(r.score).toBeCloseTo(36.17, 1);
    expect(r.status).toBe("Elevated");
    expect(r.deltaVesselCount).toBe(10);
    expect(r.slowMovingRatio).toBeCloseTo(0.2, 5);
  });

  it("reports Fluid when traffic is light and moving", () => {
    const r = calculateCongestion({
      vesselCount: 15,
      baselineVesselCount: 40,
      slowMovingCount: 0,
      stationaryCount: 0,
      averageSpeedKnots: 9,
    });
    expect(r.status).toBe("Fluid");
    expect(r.score).toBeLessThanOrEqual(33);
    expect(r.deltaVesselCount).toBeNull();
  });

  it("reports Severe under dense, stalled traffic", () => {
    const r = calculateCongestion({
      vesselCount: 120,
      baselineVesselCount: 40, // well above 2× baseline => density 100
      slowMovingCount: 90,
      stationaryCount: 30,
      averageSpeedKnots: 1,
    });
    expect(r.status).toBe("Severe");
    expect(r.score).toBeGreaterThan(66);
  });

  it("never divides by zero when no vessels are detected", () => {
    const r = calculateCongestion({
      vesselCount: 0,
      baselineVesselCount: 40,
      slowMovingCount: 0,
      stationaryCount: 0,
      averageSpeedKnots: 0,
    });
    expect(r.score).toBe(0);
    expect(r.slowMovingRatio).toBe(0);
  });
});
