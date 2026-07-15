/**
 * Estimated Tuas Congestion engine (§13). This is an AIS-based ANALYTICAL
 * ESTIMATE from vessel density, speed and dwell indicators — NOT official PSA
 * berth occupancy, queue or waiting-time data. That disclaimer is enforced in
 * the UI; this module only computes the estimate.
 *
 *   Estimated Congestion =
 *       Normalised Vessel Density        × 0.40
 *     + Slow-Moving Vessel Ratio         × 0.35
 *     + Apparently Stationary Ratio      × 0.25
 */

import type {
  CongestionInput,
  CongestionResult,
  CongestionStatus,
} from "@/types";
import { CONGESTION_CONFIG, CONGESTION_SUBWEIGHTS } from "./risk-config";
import { clamp100, normaliseToScore, round, safeRatio } from "@/lib/utils/math";

function congestionStatus(score: number): CongestionStatus {
  const { fluidMax, elevatedMax } = CONGESTION_CONFIG.statusThresholds;
  if (score <= fluidMax) return "Fluid";
  if (score <= elevatedMax) return "Elevated";
  return "Severe";
}

export function calculateCongestion(
  input: CongestionInput,
): CongestionResult {
  const vesselCount = Math.max(0, input.vesselCount);
  const slowMovingCount = Math.max(0, input.slowMovingCount);
  const stationaryCount = Math.max(0, input.stationaryCount);

  // Density is scored relative to the scenario baseline vessel count.
  const baseline = Math.max(1, input.baselineVesselCount);
  const lowCount = baseline * CONGESTION_CONFIG.densityLowMultiple;
  const highCount = baseline * CONGESTION_CONFIG.densityHighMultiple;
  const normalisedDensity = normaliseToScore(vesselCount, lowCount, highCount);

  // Ratios are of the currently detected vessels (0..1).
  const slowMovingRatio = safeRatio(slowMovingCount, vesselCount);
  const stationaryRatio = safeRatio(stationaryCount, vesselCount);

  const densityComponent = normalisedDensity * CONGESTION_SUBWEIGHTS.density;
  const slowComponent =
    slowMovingRatio * 100 * CONGESTION_SUBWEIGHTS.slowMoving;
  const stationaryComponent =
    stationaryRatio * 100 * CONGESTION_SUBWEIGHTS.stationary;

  const score = clamp100(densityComponent + slowComponent + stationaryComponent);

  const deltaVesselCount =
    input.previousVesselCount == null
      ? null
      : vesselCount - input.previousVesselCount;

  return {
    score: round(score),
    status: congestionStatus(score),
    normalisedDensity: round(normalisedDensity),
    slowMovingRatio: round(slowMovingRatio, 4),
    stationaryRatio: round(stationaryRatio, 4),
    averageSpeedKnots: round(Math.max(0, input.averageSpeedKnots)),
    vesselCount,
    slowMovingCount,
    stationaryCount,
    deltaVesselCount,
    breakdown: {
      densityComponent: round(densityComponent),
      slowComponent: round(slowComponent),
      stationaryComponent: round(stationaryComponent),
    },
  };
}
