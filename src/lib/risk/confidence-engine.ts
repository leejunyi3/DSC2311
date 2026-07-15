/**
 * Data confidence engine (§13). Confidence and risk are DIFFERENT concepts —
 * confidence must never be computed as `100 - risk`. It reflects how much we
 * should trust the current picture given source reliability, freshness,
 * geographic relevance, feed availability, source agreement and whether data is
 * live vs cached / estimated / simulated.
 */

import type {
  ConfidenceClass,
  ConfidenceResult,
  ConfidenceSourceInput,
} from "@/types";
import { CONFIDENCE_CONFIG } from "./risk-config";
import { clamp, clamp100, round } from "@/lib/utils/math";
import { freshnessFactor } from "./freshness-engine";

function confidenceClass(score: number): ConfidenceClass {
  const { lowMax, mediumMax } = CONFIDENCE_CONFIG.classThresholds;
  if (score <= lowMax) return "Low";
  if (score <= mediumMax) return "Medium";
  return "High";
}

/** Per-source confidence contribution (0..100) before averaging. */
function sourceConfidence(source: ConfidenceSourceInput): number {
  const status = CONFIDENCE_CONFIG.statusFactor[source.status];
  const fresh = freshnessFactor(
    source.ageSeconds,
    source.expectedFreshnessSeconds,
  );
  const reliability = clamp(source.reliability, 0, 1);
  const geo = clamp(source.geographicRelevance, 0, 1);
  return clamp100(reliability * status * fresh * geo * 100);
}

export interface ConfidenceParams {
  sources: ConfidenceSourceInput[];
  /**
   * 0..1 agreement between sources (e.g. do independent feeds corroborate the
   * same picture). Applied as a multiplier, floored at `minAgreementFactor` so
   * a single disagreement cannot zero out confidence on its own.
   */
  agreement: number;
}

export function calculateConfidence(
  params: ConfidenceParams,
): ConfidenceResult {
  const totalFeeds = params.sources.length;

  const available = params.sources.filter((s) => s.status !== "UNAVAILABLE");
  const availableFeeds = available.length;

  const staleFeeds: string[] = [];
  const unavailableFeeds: string[] = [];

  for (const s of params.sources) {
    if (s.status === "UNAVAILABLE") {
      unavailableFeeds.push(s.name);
      continue;
    }
    const f = freshnessFactor(s.ageSeconds, s.expectedFreshnessSeconds);
    if (f < 0.5) staleFeeds.push(s.name);
  }

  // Mean confidence over available sources.
  const meanAvailable =
    availableFeeds === 0
      ? 0
      : available.reduce((sum, s) => sum + sourceConfidence(s), 0) /
        availableFeeds;

  // Feed-availability factor: losing feeds lowers confidence proportionally.
  const availabilityFactor =
    totalFeeds === 0 ? 0 : availableFeeds / totalFeeds;

  const agreement = clamp(
    Math.max(params.agreement, CONFIDENCE_CONFIG.minAgreementFactor),
    0,
    1,
  );

  const score = clamp100(meanAvailable * availabilityFactor * agreement);

  const mainLimitation = buildMainLimitation({
    availableFeeds,
    totalFeeds,
    unavailableFeeds,
    staleFeeds,
    agreement: params.agreement,
  });

  return {
    score: round(score),
    class: confidenceClass(score),
    availableFeeds,
    totalFeeds,
    staleFeeds,
    unavailableFeeds,
    agreement: round(agreement, 3),
    mainLimitation,
  };
}

function buildMainLimitation(ctx: {
  availableFeeds: number;
  totalFeeds: number;
  unavailableFeeds: string[];
  staleFeeds: string[];
  agreement: number;
}): string {
  if (ctx.unavailableFeeds.length > 0) {
    return `Unavailable feed(s): ${ctx.unavailableFeeds.join(", ")}. Confidence reduced.`;
  }
  if (ctx.staleFeeds.length > 0) {
    return `Aging feed(s): ${ctx.staleFeeds.join(", ")}. Data may not reflect current conditions.`;
  }
  if (ctx.agreement < 0.6) {
    return "Sources partially disagree; recommendation treated as conditional.";
  }
  if (ctx.totalFeeds === 0) {
    return "No data sources supplied.";
  }
  return "All monitored feeds available and reasonably fresh.";
}
