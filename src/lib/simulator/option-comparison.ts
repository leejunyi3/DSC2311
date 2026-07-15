/**
 * Deterministic response-option comparison (§20). Builds the wait / reroute /
 * emergency-replenishment options from the same validated simulator input,
 * runs the inventory engine on each, and applies the PROJECT cargo-priority
 * policy (pharma & cold-chain integrity before cost) to pick a recommendation.
 *
 * This is a project policy, not an official PSA policy, and every high-impact
 * recommendation requires human authorisation before any operational action.
 */

import type {
  AlternativeKind,
  OptionComparisonResult,
  ResponseOption,
  SimulationInput,
} from "@/types";
import { calculateInventory } from "./inventory-engine";

const ALTERNATIVE_LABELS: Record<AlternativeKind, string> = {
  wait: "Continue to Tuas and wait",
  "tanjung-pelepas": "Reroute — Port of Tanjung Pelepas",
  "port-klang": "Reroute — Port Klang",
  "airfreight-changi": "Emergency airfreight via Changi",
  custom: "User-defined alternative",
};

function buildOptions(input: SimulationInput): ResponseOption[] {
  const options: ResponseOption[] = [];

  // 1) Wait — no rerouting or emergency cost; delay is the current expectation.
  options.push({
    kind: "wait",
    label: ALTERNATIVE_LABELS.wait,
    delayHours: input.expectedDelayHours,
    inventory: calculateInventory({
      safetyStockDays: input.safetyStockDays,
      dailyDemand: input.dailyDemand,
      unitShortageCost: input.unitShortageCost,
      effectiveDelayHours: input.expectedDelayHours,
      additionalReroutingCost: 0,
      emergencyReplenishmentCost: 0,
      coldChain: input.coldChain,
      criticality: input.criticality,
      customerPriority: input.customerPriority,
    }),
    notes: ["Assumes the current expected delay holds and no mitigation is taken."],
  });

  // 2) Reroute — only when a genuine alternative port/route was selected.
  if (input.alternativeKind !== "wait" && input.alternativeKind !== "airfreight-changi") {
    const rerouteDelay =
      input.alternativeTransitHours + input.additionalHandlingHours;
    options.push({
      kind: input.alternativeKind,
      label: ALTERNATIVE_LABELS[input.alternativeKind],
      delayHours: rerouteDelay,
      inventory: calculateInventory({
        safetyStockDays: input.safetyStockDays,
        dailyDemand: input.dailyDemand,
        unitShortageCost: input.unitShortageCost,
        effectiveDelayHours: rerouteDelay,
        additionalReroutingCost: input.additionalReroutingCost,
        emergencyReplenishmentCost: 0,
        coldChain: input.coldChain,
        criticality: input.criticality,
        customerPriority: input.customerPriority,
      }),
      notes: [
        "Transit + handling/customs delay is a user or scenario assumption, not live port data.",
      ],
    });
  }

  // 2b) Airfreight is modelled as a fast reroute carrying the rerouting cost.
  if (input.alternativeKind === "airfreight-changi") {
    const airDelay = input.alternativeTransitHours + input.additionalHandlingHours;
    options.push({
      kind: "airfreight-changi",
      label: ALTERNATIVE_LABELS["airfreight-changi"],
      delayHours: airDelay,
      inventory: calculateInventory({
        safetyStockDays: input.safetyStockDays,
        dailyDemand: input.dailyDemand,
        unitShortageCost: input.unitShortageCost,
        effectiveDelayHours: airDelay,
        additionalReroutingCost: input.additionalReroutingCost,
        emergencyReplenishmentCost: 0,
        coldChain: input.coldChain,
        criticality: input.criticality,
        customerPriority: input.customerPriority,
      }),
      notes: [
        "Airfreight transit and cost are user/scenario assumptions, not a live quote.",
      ],
    });
  }

  // 3) Emergency replenishment — only when a quantity or cost is configured.
  if (
    input.emergencyReplenishmentQty > 0 ||
    input.emergencyReplenishmentCost > 0
  ) {
    options.push({
      kind: "custom",
      label: "Emergency replenishment",
      delayHours: input.emergencyReplenishmentLeadHours,
      inventory: calculateInventory({
        safetyStockDays: input.safetyStockDays,
        dailyDemand: input.dailyDemand,
        unitShortageCost: input.unitShortageCost,
        effectiveDelayHours: input.emergencyReplenishmentLeadHours,
        additionalReroutingCost: 0,
        emergencyReplenishmentCost: input.emergencyReplenishmentCost,
        coldChain: input.coldChain,
        criticality: input.criticality,
        customerPriority: input.customerPriority,
      }),
      notes: [
        "Emergency lead time, quantity and cost are user-entered assumptions.",
      ],
    });
  }

  return options;
}

/** Lower total cost wins; ties break toward the shorter delay. */
function cheaper(a: ResponseOption, b: ResponseOption): ResponseOption {
  if (a.inventory.totalScenarioCost !== b.inventory.totalScenarioCost) {
    return a.inventory.totalScenarioCost < b.inventory.totalScenarioCost ? a : b;
  }
  return a.delayHours <= b.delayHours ? a : b;
}

export function compareResponseOptions(
  input: SimulationInput,
): OptionComparisonResult {
  const options = buildOptions(input);

  const assumptions: string[] = [
    "Alternative-port transit times and costs are user or scenario assumptions — the system does not hold live availability, transit or pricing for other ports.",
    "Inventory figures follow the deterministic formulas on the Methodology page.",
  ];

  // Project cargo-priority policy: for cold-chain cargo, avoid options that
  // leave cold-chain exposure "critical" whenever a non-critical option exists.
  const nonCriticalColdChain = options.filter(
    (o) => o.inventory.coldChainExposure !== "critical",
  );
  const pool =
    input.coldChain && nonCriticalColdChain.length > 0
      ? nonCriticalColdChain
      : options;

  let recommended = pool.reduce(cheaper);

  let recommendationReason: string;
  if (
    input.coldChain &&
    nonCriticalColdChain.length > 0 &&
    pool.length < options.length
  ) {
    recommendationReason = `Cold-chain integrity is prioritised over cost: "${recommended.label}" is the lowest-cost option that avoids critical cold-chain exposure.`;
  } else if (input.coldChain && nonCriticalColdChain.length === 0) {
    recommendationReason = `Every option leaves critical cold-chain exposure. "${recommended.label}" is the lowest-cost among them — escalate for human decision on cargo prioritisation.`;
    assumptions.push(
      "No modelled option fully protects the cold chain; human escalation is required.",
    );
  } else {
    recommendationReason = `"${recommended.label}" has the lowest total scenario cost (${recommended.inventory.totalScenarioCost.toLocaleString()}) among the modelled options.`;
  }

  const requiresHumanApproval =
    input.coldChain ||
    input.criticality === "critical" ||
    recommended.kind !== "wait" ||
    recommended.inventory.serviceLevelRisk === "high" ||
    recommended.inventory.serviceLevelRisk === "critical";

  return {
    options,
    recommendedKind: recommended.kind,
    recommendationReason,
    assumptions,
    requiresHumanApproval,
  };
}
