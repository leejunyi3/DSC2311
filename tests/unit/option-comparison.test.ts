import { describe, it, expect } from "vitest";
import { compareResponseOptions } from "@/lib/simulator/option-comparison";
import type { SimulationInput } from "@/types";

const pharmaCrisis: SimulationInput = {
  cargoType: "pharmaceuticals",
  criticality: "critical",
  coldChain: true,
  safetyStockDays: 1.5,
  dailyDemand: 500,
  expectedDelayHours: 36,
  unitShortageCost: 80,
  alternativeKind: "tanjung-pelepas",
  alternativeTransitHours: 18,
  additionalHandlingHours: 6,
  additionalReroutingCost: 40_000,
  customerPriority: "key-account",
  emergencyReplenishmentQty: 1000,
  emergencyReplenishmentLeadHours: 12,
  emergencyReplenishmentCost: 90_000,
};

describe("option comparison", () => {
  it("prioritises cold-chain integrity over pure cost for pharma cargo", () => {
    const r = compareResponseOptions(pharmaCrisis);
    // wait, reroute and emergency options
    expect(r.options).toHaveLength(3);
    // wait is cheapest (0) but leaves critical cold-chain exposure, so it loses
    expect(r.recommendedKind).toBe("custom"); // emergency replenishment
    expect(r.recommendationReason).toContain("Cold-chain");
    expect(r.requiresHumanApproval).toBe(true);
  });

  it("picks the lowest-cost option for non-cold-chain general cargo", () => {
    const r = compareResponseOptions({
      cargoType: "general",
      criticality: "standard",
      coldChain: false,
      safetyStockDays: 5,
      dailyDemand: 100,
      expectedDelayHours: 24,
      unitShortageCost: 10,
      alternativeKind: "port-klang",
      alternativeTransitHours: 30,
      additionalHandlingHours: 6,
      additionalReroutingCost: 5000,
      customerPriority: "standard",
      emergencyReplenishmentQty: 0,
      emergencyReplenishmentLeadHours: 0,
      emergencyReplenishmentCost: 0,
    });
    expect(r.options).toHaveLength(2); // wait + reroute (no emergency configured)
    expect(r.recommendedKind).toBe("wait");
    expect(r.requiresHumanApproval).toBe(false);
  });

  it("always surfaces assumptions about alternative-port data", () => {
    const r = compareResponseOptions(pharmaCrisis);
    expect(r.assumptions.some((a) => a.toLowerCase().includes("assumption"))).toBe(
      true,
    );
  });
});
