import { describe, it, expect } from "vitest";
import { calculateInventory } from "@/lib/simulator/inventory-engine";

const base = {
  safetyStockDays: 1.5,
  dailyDemand: 100,
  unitShortageCost: 50,
  additionalReroutingCost: 0,
  emergencyReplenishmentCost: 0,
  coldChain: false,
  criticality: "standard" as const,
  customerPriority: "standard" as const,
};

describe("inventory engine — safety-stock coverage", () => {
  it("computes remaining coverage and coverage gap", () => {
    const r = calculateInventory({ ...base, effectiveDelayHours: 48 }); // 2 days
    expect(r.effectiveDelayDays).toBe(2);
    expect(r.remainingCoverageDays).toBe(-0.5); // 1.5 - 2
    expect(r.coverageGapDays).toBe(0.5); // max(0, 2 - 1.5)
    expect(r.potentialShortageUnits).toBe(50); // 0.5 * 100
    expect(r.potentialShortageCost).toBe(2500); // 50 * 50
  });

  it("has no gap when safety stock covers the delay", () => {
    const r = calculateInventory({
      ...base,
      safetyStockDays: 4,
      effectiveDelayHours: 48,
    });
    expect(r.coverageGapDays).toBe(0);
    expect(r.potentialShortageUnits).toBe(0);
    expect(r.inventoryExposureScore).toBe(50); // 2 / 4 * 100
  });

  it("returns exposure 100 when safety stock is zero and there is a delay", () => {
    const r = calculateInventory({
      ...base,
      safetyStockDays: 0,
      dailyDemand: 200,
      effectiveDelayHours: 24,
    });
    expect(r.inventoryExposureScore).toBe(100);
    expect(r.coverageGapDays).toBe(1);
    expect(r.potentialShortageUnits).toBe(200);
  });

  it("sums the total scenario cost across rerouting, shortage and emergency", () => {
    const r = calculateInventory({
      ...base,
      effectiveDelayHours: 48, // shortage cost 2500
      additionalReroutingCost: 1000,
      emergencyReplenishmentCost: 500,
    });
    expect(r.totalScenarioCost).toBe(4000); // 1000 + 2500 + 500
  });

  it("classifies cold-chain and service-level risk with policy bumps", () => {
    const r = calculateInventory({
      ...base,
      safetyStockDays: 1.5,
      effectiveDelayHours: 48, // exposure 100
      coldChain: true,
      criticality: "critical",
      customerPriority: "key-account",
    });
    expect(r.coldChainExposure).toBe("critical");
    expect(r.serviceLevelRisk).toBe("critical");
  });
});
