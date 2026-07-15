/**
 * Deterministic supply-chain inventory engine (§20). Implements the published
 * formulas exactly. Claude may explain these outputs but must use them verbatim
 * rather than inventing numbers.
 *
 *   Delay Days              = Delay Hours ÷ 24
 *   Remaining Coverage Days = Safety Stock Days − Effective Delay Days
 *   Coverage Gap Days       = max(0, Effective Delay Days − Safety Stock Days)
 *   Potential Shortage Units= Coverage Gap Days × Daily Demand
 *   Inventory Exposure      = 100 if SS ≤ 0 and delay > 0
 *                             else min(100, Delay ÷ max(SS, 0.25) × 100)
 *   Potential Shortage Cost = Potential Shortage Units × Unit Shortage Cost
 *   Total Scenario Cost     = Rerouting + Shortage + Emergency Replenishment
 */

import type {
  ColdChainExposure,
  CustomerPriority,
  InventoryResult,
  ServiceLevelRisk,
  ShipmentCriticality,
} from "@/types";
import { clamp100, round } from "@/lib/utils/math";

export interface InventoryParams {
  safetyStockDays: number;
  dailyDemand: number;
  unitShortageCost: number;
  /** Delay this option incurs, in hours. */
  effectiveDelayHours: number;
  /** Costs applicable to THIS option only (0 when not relevant). */
  additionalReroutingCost: number;
  emergencyReplenishmentCost: number;
  coldChain: boolean;
  criticality: ShipmentCriticality;
  customerPriority: CustomerPriority;
}

const LEVELS: ServiceLevelRisk[] = ["low", "moderate", "high", "critical"];

function scoreToLevel(score: number): ServiceLevelRisk {
  if (score < 25) return "low";
  if (score < 50) return "moderate";
  if (score < 75) return "high";
  return "critical";
}

/** Raise a level by `steps`, clamped at "critical". */
function bumpLevel(level: ServiceLevelRisk, steps: number): ServiceLevelRisk {
  const idx = Math.min(LEVELS.length - 1, LEVELS.indexOf(level) + steps);
  return LEVELS[idx] ?? "critical";
}

function coldChainExposure(
  coldChain: boolean,
  exposureScore: number,
): ColdChainExposure {
  if (!coldChain) return "none";
  if (exposureScore >= 66) return "critical";
  if (exposureScore >= 33) return "elevated";
  return "monitor";
}

function serviceLevelRisk(
  exposureScore: number,
  customerPriority: CustomerPriority,
  criticality: ShipmentCriticality,
): ServiceLevelRisk {
  let level = scoreToLevel(exposureScore);
  if (customerPriority === "key-account") level = bumpLevel(level, 1);
  if (criticality === "critical") level = bumpLevel(level, 1);
  return level;
}

export function calculateInventory(params: InventoryParams): InventoryResult {
  const safetyStockDays = Math.max(0, params.safetyStockDays);
  const dailyDemand = Math.max(0, params.dailyDemand);
  const unitShortageCost = Math.max(0, params.unitShortageCost);
  const effectiveDelayHours = Math.max(0, params.effectiveDelayHours);

  const effectiveDelayDays = effectiveDelayHours / 24;
  const remainingCoverageDays = safetyStockDays - effectiveDelayDays;
  const coverageGapDays = Math.max(0, effectiveDelayDays - safetyStockDays);
  const potentialShortageUnits = coverageGapDays * dailyDemand;

  const inventoryExposureScore =
    safetyStockDays <= 0 && effectiveDelayDays > 0
      ? 100
      : clamp100((effectiveDelayDays / Math.max(safetyStockDays, 0.25)) * 100);

  const potentialShortageCost = potentialShortageUnits * unitShortageCost;

  const totalScenarioCost =
    Math.max(0, params.additionalReroutingCost) +
    potentialShortageCost +
    Math.max(0, params.emergencyReplenishmentCost);

  return {
    effectiveDelayHours: round(effectiveDelayHours),
    effectiveDelayDays: round(effectiveDelayDays, 3),
    remainingCoverageDays: round(remainingCoverageDays, 3),
    coverageGapDays: round(coverageGapDays, 3),
    potentialShortageUnits: round(potentialShortageUnits, 2),
    inventoryExposureScore: round(inventoryExposureScore),
    potentialShortageCost: round(potentialShortageCost, 2),
    totalScenarioCost: round(totalScenarioCost, 2),
    coldChainExposure: coldChainExposure(
      params.coldChain,
      inventoryExposureScore,
    ),
    serviceLevelRisk: serviceLevelRisk(
      inventoryExposureScore,
      params.customerPriority,
      params.criticality,
    ),
  };
}
