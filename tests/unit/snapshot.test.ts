import { describe, it, expect } from "vitest";
import { buildSnapshot, type BuildSnapshotOptions } from "@/lib/snapshot/build-snapshot";

const baseOptions = (
  over: Partial<BuildSnapshotOptions> = {},
): BuildSnapshotOptions => ({
  mode: "demo",
  scenarioId: "pharmaceutical-crisis",
  seed: 2301,
  cacheTtlSeconds: 300,
  liveToggles: {
    weather: false,
    lightning: false,
    marine: false,
    vessels: false,
    disruptions: false,
  },
  ...over,
});

describe("snapshot — demo mode determinism", () => {
  it("produces identical core figures for the same seed + scenario", async () => {
    const a = await buildSnapshot(baseOptions());
    const b = await buildSnapshot(baseOptions());
    expect(a.risk.overall).toBe(b.risk.overall);
    expect(a.risk.category).toBe(b.risk.category);
    expect(a.congestion.data?.score).toBe(b.congestion.data?.score);
    expect(a.vessels.data?.vesselCount).toBe(b.vessels.data?.vesselCount);
    expect(a.vessels.data?.vessels[0]?.mmsi).toBe(b.vessels.data?.vessels[0]?.mmsi);
  });

  it("classifies every demo feed as SIMULATED with the demo disclaimer", async () => {
    const s = await buildSnapshot(baseOptions());
    expect(s.mode).toBe("demo");
    expect(s.connectivity).toBe("demo");
    expect(s.weather.status).toBe("SIMULATED");
    expect(s.weather.limitations).toContain("Simulated Demo Data");
    expect(s.congestion.status).toBe("ESTIMATED");
    expect(s.congestion.limitations.join(" ")).toContain(
      "not official PSA berth occupancy",
    );
  });
});

describe("snapshot — scenario switching updates the shared dataset", () => {
  it("normal-operations is calmer than pharmaceutical-crisis", async () => {
    const calm = await buildSnapshot(
      baseOptions({ scenarioId: "normal-operations" }),
    );
    const crisis = await buildSnapshot(
      baseOptions({ scenarioId: "pharmaceutical-crisis" }),
    );
    expect(calm.risk.overall).toBeLessThan(crisis.risk.overall);
    expect(calm.disruptions.data?.length ?? 0).toBeLessThan(
      crisis.disruptions.data?.length ?? 0,
    );
  });
});

describe("snapshot — live mode fails safe (no network, feeds disabled)", () => {
  it("marks feeds UNAVAILABLE and reports critical connectivity", async () => {
    const s = await buildSnapshot(baseOptions({ mode: "live" }));
    expect(s.mode).toBe("live");
    expect(s.weather.status).toBe("UNAVAILABLE");
    expect(s.vessels.status).toBe("UNAVAILABLE");
    // weather + vessels both down => critical
    expect(s.connectivity).toBe("critical");
    // it must not silently substitute simulated data in live mode
    expect(s.weather.status).not.toBe("SIMULATED");
  });
});
