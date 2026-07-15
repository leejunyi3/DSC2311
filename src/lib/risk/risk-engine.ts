/**
 * Deterministic overall-risk engine (§13). Claude may EXPLAIN these numbers but
 * must never invent them — every figure the assistant quotes is produced here.
 *
 *   Overall Risk =
 *       Weather Risk               × 0.30
 *     + Estimated Congestion Risk  × 0.30
 *     + Maritime Disruption Risk   × 0.20
 *     + Cargo Exposure Risk        × 0.15
 *     + Data Quality Penalty       × 0.05      (clamped 0–100)
 *
 * All weights and thresholds come from risk-config.ts.
 */

import type {
  CargoExposureInput,
  DisruptionRiskItem,
  RiskCategory,
  RiskComponents,
  RiskDriver,
  RiskResult,
  WeatherRiskInput,
} from "@/types";
import {
  CARGO_BASE_EXPOSURE,
  CARGO_CONFIG,
  DISRUPTION_CONFIG,
  DISRUPTION_SEVERITY_SCORE,
  RISK_CATEGORY_THRESHOLDS,
  RISK_WEIGHTS,
  WEATHER_SUBWEIGHTS,
  WEATHER_THRESHOLDS,
} from "./risk-config";
import { clamp, clamp100, normaliseToScore, round } from "@/lib/utils/math";

// ── Category mapping ───────────────────────────────────────────────────
export function categoriseRisk(score: number): RiskCategory {
  const s = clamp100(score);
  for (const band of RISK_CATEGORY_THRESHOLDS) {
    if (s <= band.max) return band.category;
  }
  return "Critical";
}

// ── Weather sub-model ──────────────────────────────────────────────────
export function calculateWeatherRisk(input: WeatherRiskInput): number {
  const parts: Array<{ score: number; weight: number }> = [];

  if (input.rainfallMmPerHr != null) {
    parts.push({
      score: normaliseToScore(
        input.rainfallMmPerHr,
        WEATHER_THRESHOLDS.rainfallMmPerHr.low,
        WEATHER_THRESHOLDS.rainfallMmPerHr.high,
      ),
      weight: WEATHER_SUBWEIGHTS.rainfall,
    });
  }

  if (input.windSpeedKnots != null) {
    parts.push({
      score: normaliseToScore(
        input.windSpeedKnots,
        WEATHER_THRESHOLDS.windSpeedKnots.low,
        WEATHER_THRESHOLDS.windSpeedKnots.high,
      ),
      weight: WEATHER_SUBWEIGHTS.wind,
    });
  }

  const lightningScore = lightningSubScore(input);
  if (lightningScore != null) {
    parts.push({ score: lightningScore, weight: WEATHER_SUBWEIGHTS.lightning });
  }

  if (input.waveHeightM != null) {
    parts.push({
      score: normaliseToScore(
        input.waveHeightM,
        WEATHER_THRESHOLDS.waveHeightM.low,
        WEATHER_THRESHOLDS.waveHeightM.high,
      ),
      weight: WEATHER_SUBWEIGHTS.wave,
    });
  }

  // Renormalise across whatever inputs are actually present so a missing
  // sensor does not silently drag the weather score toward zero.
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = parts.reduce((s, p) => s + p.score * p.weight, 0);
  return clamp100(weighted / totalWeight);
}

/** Lightning contributes the WORSE of proximity and recent-activity signals. */
function lightningSubScore(input: WeatherRiskInput): number | null {
  const scores: number[] = [];

  if (input.lightningNearestKm != null) {
    const { dangerKm, safeKm } = WEATHER_THRESHOLDS.lightningNearestKm;
    // Closer = higher risk, so invert the distance mapping.
    const proximity = 100 - normaliseToScore(input.lightningNearestKm, dangerKm, safeKm);
    scores.push(clamp100(proximity));
  }
  if (input.lightningRecentCount != null) {
    scores.push(
      normaliseToScore(
        input.lightningRecentCount,
        WEATHER_THRESHOLDS.lightningRecentCount.low,
        WEATHER_THRESHOLDS.lightningRecentCount.high,
      ),
    );
  }
  if (scores.length === 0) return null;
  return Math.max(...scores);
}

// ── Maritime disruption sub-model ──────────────────────────────────────
/** Score a single disruption 0–100 with recency decay + corroboration bonus. */
export function scoreDisruption(item: DisruptionRiskItem): number {
  const base = DISRUPTION_SEVERITY_SCORE[item.severity];
  const relevance = Math.max(
    clamp(item.routeRelevance, 0, 1),
    clamp(item.locationRelevance, 0, 1),
  );
  const reliability = clamp(item.sourceReliability, 0, 1);
  // Exponential recency decay: weight halves every `recencyHalfLifeHours`.
  const recency = Math.pow(
    0.5,
    Math.max(0, item.ageHours) / DISRUPTION_CONFIG.recencyHalfLifeHours,
  );
  const core = base * relevance * reliability * recency;

  const corroboration = Math.min(
    DISRUPTION_CONFIG.corroborationBonusCap,
    Math.max(0, item.supportingSources - 1) *
      DISRUPTION_CONFIG.corroborationBonusPerSource,
  );

  return clamp100(core + corroboration);
}

/** The worst active disruption drives the maritime-disruption component. */
export function calculateDisruptionRisk(items: DisruptionRiskItem[]): number {
  if (items.length === 0) return 0;
  return clamp100(Math.max(...items.map(scoreDisruption)));
}

// ── Cargo exposure sub-model ───────────────────────────────────────────
export function calculateCargoExposure(input: CargoExposureInput): number {
  let base: number = CARGO_BASE_EXPOSURE[input.cargoClass];
  if (input.coldChain) base += CARGO_CONFIG.coldChainBonus;
  base += CARGO_CONFIG.criticalityBonus[input.criticality];
  base = clamp100(base);

  if (input.inventoryExposureScore != null) {
    const w = CARGO_CONFIG.inventoryExposureWeight;
    return clamp100(base * (1 - w) + clamp100(input.inventoryExposureScore) * w);
  }
  return base;
}

// ── Overall aggregation ────────────────────────────────────────────────
export interface RiskEngineInput {
  weather: WeatherRiskInput;
  /** Pre-computed 0–100 congestion score from the congestion engine. */
  congestionScore: number;
  disruptions: DisruptionRiskItem[];
  cargo: CargoExposureInput;
  /** 0–100 confidence from the confidence engine (drives the data penalty). */
  dataConfidence: number;
  previousOverall?: number | null;
}

const DRIVER_LABELS: Record<keyof RiskComponents, string> = {
  weather: "Weather",
  congestion: "Estimated congestion",
  disruption: "Maritime disruption",
  cargo: "Cargo exposure",
  dataQualityPenalty: "Data-quality penalty",
};

export function calculateResilienceRisk(input: RiskEngineInput): RiskResult {
  const components: RiskComponents = {
    weather: round(calculateWeatherRisk(input.weather)),
    congestion: round(clamp100(input.congestionScore)),
    disruption: round(calculateDisruptionRisk(input.disruptions)),
    cargo: round(calculateCargoExposure(input.cargo)),
    // Poor data quality (low confidence) increases risk slightly.
    dataQualityPenalty: round(clamp100(100 - clamp100(input.dataConfidence))),
  };

  const weightedContributions: RiskComponents = {
    weather: round(components.weather * RISK_WEIGHTS.weather),
    congestion: round(components.congestion * RISK_WEIGHTS.congestion),
    disruption: round(components.disruption * RISK_WEIGHTS.disruption),
    cargo: round(components.cargo * RISK_WEIGHTS.cargo),
    dataQualityPenalty: round(
      components.dataQualityPenalty * RISK_WEIGHTS.dataQuality,
    ),
  };

  const overall = clamp100(
    weightedContributions.weather +
      weightedContributions.congestion +
      weightedContributions.disruption +
      weightedContributions.cargo +
      weightedContributions.dataQualityPenalty,
  );

  const drivers: RiskDriver[] = (
    Object.keys(weightedContributions) as Array<keyof RiskComponents>
  )
    .map((key) => ({
      label: DRIVER_LABELS[key],
      contribution: weightedContributions[key],
      component: key,
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  const previousOverall = input.previousOverall ?? null;
  const delta = previousOverall == null ? null : round(overall - previousOverall);

  return {
    overall: round(overall),
    category: categoriseRisk(overall),
    components,
    weightedContributions,
    drivers,
    previousOverall,
    delta,
  };
}
