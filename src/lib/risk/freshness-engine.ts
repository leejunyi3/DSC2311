/**
 * Freshness classification (§9, §13). Turns an observation age into a class and
 * a 0..1 discount factor used to lower confidence for aging data. Pure and
 * deterministic — no clocks are read inside; callers pass `ageSeconds`.
 */

import type { FreshnessClass, FreshnessResult } from "@/types";
import { FRESHNESS_CONFIG } from "./risk-config";
import { clamp } from "@/lib/utils/math";

export function classifyFreshness(
  ageSeconds: number,
  expectedFreshnessSeconds: number,
): FreshnessClass {
  if (expectedFreshnessSeconds <= 0 || ageSeconds < 0) return "EXPIRED";
  const ratio = ageSeconds / expectedFreshnessSeconds;
  if (ratio <= FRESHNESS_CONFIG.freshMultiple) return "FRESH";
  if (ratio <= FRESHNESS_CONFIG.recentMultiple) return "RECENT";
  if (ratio <= FRESHNESS_CONFIG.staleMultiple) return "STALE";
  return "EXPIRED";
}

/**
 * Confidence discount factor for aging data: 1.0 while fresh, decaying linearly
 * to 0.0 at `staleMultiple × expected`, and 0.0 once expired.
 */
export function freshnessFactor(
  ageSeconds: number,
  expectedFreshnessSeconds: number,
): number {
  if (expectedFreshnessSeconds <= 0 || ageSeconds < 0) return 0;
  const span = FRESHNESS_CONFIG.staleMultiple * expectedFreshnessSeconds;
  return clamp(1 - ageSeconds / span, 0, 1);
}

export function evaluateFreshness(
  ageSeconds: number,
  expectedFreshnessSeconds: number,
): FreshnessResult {
  return {
    class: classifyFreshness(ageSeconds, expectedFreshnessSeconds),
    ageSeconds,
    expectedFreshnessSeconds,
    factor: freshnessFactor(ageSeconds, expectedFreshnessSeconds),
  };
}

/**
 * Compute age in seconds between an observation time and a reference time
 * (default: now). Never negative.
 */
export function ageSecondsFrom(
  observedAtIso: string,
  referenceIso?: string,
): number {
  const observed = new Date(observedAtIso).getTime();
  const reference = referenceIso ? new Date(referenceIso).getTime() : Date.now();
  if (Number.isNaN(observed) || Number.isNaN(reference)) return 0;
  return Math.max(0, Math.round((reference - observed) / 1000));
}
