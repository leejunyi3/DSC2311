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
  "johor-pasir-gudang": "Reroute — Johor Port (Pasir Gudang)",
  batam: "Reroute — Batam (Indonesia)",
  penang: "Reroute — Penang Port",
  "jurong-port": "Reroute — Jurong Port (Singapore)",
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

/**
 * Apply the project cargo-priority policy to a set of options and pick a
 * recommendation. Shared by the single-alternative comparison and the
 * suggest-best-route search.
 */
function recommendFrom(
  options: ResponseOption[],
  input: SimulationInput,
  extraAssumptions: string[],
): OptionComparisonResult {
  const assumptions: string[] = [
    "Alternative-port transit times and costs are assumptions — the system holds no live availability, transit or pricing for other ports.",
    "Inventory figures follow the deterministic formulas on the Methodology page.",
    ...extraAssumptions,
  ];

  // For cold-chain cargo, avoid options that leave cold-chain exposure
  // "critical" whenever a non-critical option exists.
  const nonCriticalColdChain = options.filter(
    (o) => o.inventory.coldChainExposure !== "critical",
  );
  const pool =
    input.coldChain && nonCriticalColdChain.length > 0
      ? nonCriticalColdChain
      : options;

  const recommended = pool.reduce(cheaper);

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

export function compareResponseOptions(
  input: SimulationInput,
): OptionComparisonResult {
  return recommendFrom(buildOptions(input), input, []);
}

/**
 * Default transit / handling / rerouting-cost ASSUMPTIONS per candidate port,
 * roughly by distance from Tuas. Not live data — clearly labelled as
 * assumptions; the planner can refine any port in the simulator.
 */
const CANDIDATE_ROUTES: ReadonlyArray<{
  kind: AlternativeKind;
  transitHours: number;
  handlingHours: number;
  reroutingCost: number;
}> = [
  // Closest, but Singapore-premium handling rates.
  { kind: "jurong-port", transitHours: 8, handlingHours: 4, reroutingCost: 30_000 },
  { kind: "tanjung-pelepas", transitHours: 14, handlingHours: 6, reroutingCost: 18_000 },
  { kind: "johor-pasir-gudang", transitHours: 16, handlingHours: 6, reroutingCost: 14_000 },
  // Indonesia — cheapest handling, moderate distance south across the strait.
  { kind: "batam", transitHours: 16, handlingHours: 6, reroutingCost: 11_000 },
  // Major Malaysian hub — far, but efficient bulk rates.
  { kind: "port-klang", transitHours: 30, handlingHours: 8, reroutingCost: 16_000 },
  { kind: "penang", transitHours: 60, handlingHours: 8, reroutingCost: 22_000 },
  // Fastest but premium.
  { kind: "airfreight-changi", transitHours: 10, handlingHours: 4, reroutingCost: 85_000 },
];

/**
 * Evaluate ALL candidate regional ports (plus wait and, if configured,
 * emergency replenishment) and recommend the single best route — so the planner
 * doesn't have to choose a port themselves. Uses the default per-port
 * assumptions above; the core inventory inputs come from `input`.
 */
export function suggestBestRoute(input: SimulationInput): OptionComparisonResult {
  const base = {
    safetyStockDays: input.safetyStockDays,
    dailyDemand: input.dailyDemand,
    unitShortageCost: input.unitShortageCost,
    coldChain: input.coldChain,
    criticality: input.criticality,
    customerPriority: input.customerPriority,
  };

  const options: ResponseOption[] = [];

  options.push({
    kind: "wait",
    label: ALTERNATIVE_LABELS.wait,
    delayHours: input.expectedDelayHours,
    inventory: calculateInventory({
      ...base,
      effectiveDelayHours: input.expectedDelayHours,
      additionalReroutingCost: 0,
      emergencyReplenishmentCost: 0,
    }),
    notes: ["Assumes the current expected delay holds and no mitigation is taken."],
  });

  for (const r of CANDIDATE_ROUTES) {
    const delay = r.transitHours + r.handlingHours;
    options.push({
      kind: r.kind,
      label: ALTERNATIVE_LABELS[r.kind],
      delayHours: delay,
      inventory: calculateInventory({
        ...base,
        effectiveDelayHours: delay,
        additionalReroutingCost: r.reroutingCost,
        emergencyReplenishmentCost: 0,
      }),
      notes: [
        `Transit ~${delay}h and $${r.reroutingCost.toLocaleString()} are default project assumptions for this port — refine in the simulator for precise figures.`,
      ],
    });
  }

  if (
    input.emergencyReplenishmentQty > 0 ||
    input.emergencyReplenishmentCost > 0
  ) {
    options.push({
      kind: "custom",
      label: "Emergency replenishment",
      delayHours: input.emergencyReplenishmentLeadHours,
      inventory: calculateInventory({
        ...base,
        effectiveDelayHours: input.emergencyReplenishmentLeadHours,
        additionalReroutingCost: 0,
        emergencyReplenishmentCost: input.emergencyReplenishmentCost,
      }),
      notes: ["Emergency lead time, quantity and cost are user-entered assumptions."],
    });
  }

  // Show cheapest first so the ranked list reads well.
  options.sort(
    (a, b) => a.inventory.totalScenarioCost - b.inventory.totalScenarioCost,
  );

  return recommendFrom(options, input, [
    "Best route chosen across candidate regional ports (Jurong, Tanjung Pelepas, Batam, Johor, Port Klang, Penang, Changi airfreight) using default transit/cost assumptions.",
  ]);
}
