import { z } from "zod";

export const cargoClassSchema = z.enum([
  "general",
  "perishables",
  "pharmaceuticals",
  "industrial",
  "medical",
]);

export const shipmentCriticalitySchema = z.enum([
  "low",
  "standard",
  "high",
  "critical",
]);

export const customerPrioritySchema = z.enum([
  "standard",
  "priority",
  "key-account",
]);

export const alternativeKindSchema = z.enum([
  "wait",
  "tanjung-pelepas",
  "port-klang",
  "airfreight-changi",
  "custom",
]);

/**
 * Validated inputs to the deterministic supply-chain simulator (§20).
 * All monetary and time values are non-negative; bounds keep a single UI field
 * from driving the engine into absurd territory.
 */
export const simulationInputSchema = z.object({
  cargoType: cargoClassSchema,
  criticality: shipmentCriticalitySchema,
  coldChain: z.boolean(),
  safetyStockDays: z.number().min(0).max(365),
  dailyDemand: z.number().min(0).max(1_000_000),
  expectedDelayHours: z.number().min(0).max(2_160), // up to 90 days
  unitShortageCost: z.number().min(0).max(1_000_000),
  alternativeKind: alternativeKindSchema,
  alternativeTransitHours: z.number().min(0).max(2_160),
  additionalHandlingHours: z.number().min(0).max(2_160),
  additionalReroutingCost: z.number().min(0).max(100_000_000),
  customerPriority: customerPrioritySchema,
  emergencyReplenishmentQty: z.number().min(0).max(10_000_000),
  emergencyReplenishmentLeadHours: z.number().min(0).max(2_160),
  emergencyReplenishmentCost: z.number().min(0).max(100_000_000),
});

export type SimulationInputParsed = z.infer<typeof simulationInputSchema>;
