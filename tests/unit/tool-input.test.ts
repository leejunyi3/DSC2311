import { describe, it, expect } from "vitest";
import {
  toolInputSchemas,
  isToolName,
  TOOL_NAMES,
} from "@/lib/schemas/tools";
import { simulationInputSchema } from "@/lib/schemas/simulator";

const validSim = {
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
  additionalReroutingCost: 40000,
  customerPriority: "key-account",
  emergencyReplenishmentQty: 1000,
  emergencyReplenishmentLeadHours: 12,
  emergencyReplenishmentCost: 90000,
};

describe("Claude tool input validation", () => {
  it("exposes all twelve tools", () => {
    expect(TOOL_NAMES).toHaveLength(12);
    expect(isToolName("run_supply_chain_simulation")).toBe(true);
    expect(isToolName("definitely_not_a_tool")).toBe(false);
  });

  it("accepts a valid simulator payload", () => {
    expect(
      toolInputSchemas.run_supply_chain_simulation.safeParse(validSim).success,
    ).toBe(true);
  });

  it("rejects out-of-range simulator inputs", () => {
    expect(
      simulationInputSchema.safeParse({ ...validSim, safetyStockDays: -1 })
        .success,
    ).toBe(false);
    expect(
      simulationInputSchema.safeParse({ ...validSim, cargoType: "explosives" })
        .success,
    ).toBe(false);
  });

  it("validates the marine-forecast location enum but allows omission", () => {
    expect(
      toolInputSchemas.get_marine_forecast.safeParse({ location: "tuas" })
        .success,
    ).toBe(true);
    expect(
      toolInputSchemas.get_marine_forecast.safeParse({}).success,
    ).toBe(true);
    expect(
      toolInputSchemas.get_marine_forecast.safeParse({ location: "mars" })
        .success,
    ).toBe(false);
  });

  it("bounds the knowledge-search query length", () => {
    expect(
      toolInputSchemas.search_institutional_knowledge.safeParse({ query: "" })
        .success,
    ).toBe(false);
    expect(
      toolInputSchemas.search_institutional_knowledge.safeParse({
        query: "cold chain policy",
      }).success,
    ).toBe(true);
  });
});
