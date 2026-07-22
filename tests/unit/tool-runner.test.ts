import { describe, it, expect, beforeAll } from "vitest";
import { buildSnapshot } from "@/lib/snapshot/build-snapshot";
import { executeTool } from "@/lib/ai/tool-runner";
import type { DashboardSnapshot } from "@/types/snapshot";
import type { BuildSnapshotOptions } from "@/lib/snapshot/build-snapshot";

const demoOptions: BuildSnapshotOptions = {
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
};

let snapshot: DashboardSnapshot;
beforeAll(async () => {
  snapshot = await buildSnapshot(demoOptions);
});

describe("tool runner", () => {
  it("rejects an unknown tool", () => {
    const r = executeTool("do_something_bad", {}, snapshot);
    expect(r.ok).toBe(false);
    expect(r.audit.errorCode).toBe("UNKNOWN_TOOL");
  });

  it("rejects invalid tool input via Zod", () => {
    const r = executeTool(
      "run_supply_chain_simulation",
      { cargoType: "explosives" },
      snapshot,
    );
    expect(r.ok).toBe(false);
    expect(r.audit.errorCode).toBe("INVALID_INPUT");
  });

  it("returns the deterministic risk for calculate_resilience_risk", () => {
    const r = executeTool("calculate_resilience_risk", {}, snapshot);
    expect(r.ok).toBe(true);
    const content = r.content as { risk: { overall: number } };
    expect(content.risk.overall).toBe(snapshot.risk.overall);
    expect(r.audit.success).toBe(true);
    expect(r.audit.dataSources.length).toBeGreaterThan(0);
  });

  it("suggests the best route matching the snapshot", () => {
    const r = executeTool(
      "suggest_best_route",
      snapshot.simulatorDefaults,
      snapshot,
    );
    expect(r.ok).toBe(true);
    const content = r.content as { recommendedKind: string };
    // The dashboard snapshot's simulation is the best-route suggestion.
    expect(content.recommendedKind).toBe(snapshot.simulation.recommendedKind);
  });

  it("runs a single-option comparison via compare_response_options", () => {
    const r = executeTool(
      "compare_response_options",
      snapshot.simulatorDefaults,
      snapshot,
    );
    expect(r.ok).toBe(true);
    const content = r.content as { options: unknown[] };
    expect(Array.isArray(content.options)).toBe(true);
  });

  it("carries the required congestion disclaimer", () => {
    const r = executeTool("get_estimated_congestion", {}, snapshot);
    const content = r.content as { limitations: string[] };
    expect(content.limitations.join(" ")).toContain(
      "not official PSA berth occupancy",
    );
  });

  it("searches institutional knowledge deterministically", () => {
    const r = executeTool(
      "search_institutional_knowledge",
      { query: "cold chain priority" },
      snapshot,
    );
    const content = r.content as { results: Array<{ id: string }> };
    expect(content.results.length).toBeGreaterThan(0);
  });
});
