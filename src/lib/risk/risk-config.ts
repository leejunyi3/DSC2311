/**
 * SINGLE SOURCE OF TRUTH for every weight and threshold used by the risk,
 * congestion, confidence and freshness engines (§13). No unexplained numbers
 * are allowed elsewhere in the engine code — if a constant matters, it lives
 * here with a comment describing what it means and where it came from.
 *
 * Unless a value is attributed to an authoritative source, treat it as a
 * PROJECT ASSUMPTION. These are NOT official PSA / MPA port-shutdown limits.
 */

import type { RiskCategory, DisruptionSeverity } from "@/types";

// ── Overall risk weights (must sum to 1.0) — §13 ───────────────────────
export const RISK_WEIGHTS = {
  weather: 0.3,
  congestion: 0.3,
  disruption: 0.2,
  cargo: 0.15,
  dataQuality: 0.05,
} as const;

// ── Overall risk category thresholds — §13 ─────────────────────────────
export const RISK_CATEGORY_THRESHOLDS: ReadonlyArray<{
  max: number;
  category: RiskCategory;
}> = [
  { max: 24, category: "Low" },
  { max: 49, category: "Moderate" },
  { max: 74, category: "High" },
  { max: 100, category: "Critical" },
];

// ── Weather sub-model (project assumptions) ────────────────────────────
// Sub-weights within the weather score (must sum to 1.0).
export const WEATHER_SUBWEIGHTS = {
  rainfall: 0.35,
  wind: 0.25,
  lightning: 0.25,
  wave: 0.15,
} as const;

// Normalisation ranges: [scoreZeroAt, scoreMaxAt].
export const WEATHER_THRESHOLDS = {
  // Rainfall intensity mm/hr. ~ >30 mm/hr is intense tropical rain.
  rainfallMmPerHr: { low: 0, high: 30 },
  // Sustained wind knots. ~40 kt is a strong gale affecting handling.
  windSpeedKnots: { low: 5, high: 40 },
  // Nearest lightning distance km — CLOSER is worse, so this maps inverted.
  // At/inside `dangerKm` = 100; at/beyond `safeKm` = 0.
  lightningNearestKm: { dangerKm: 5, safeKm: 30 },
  // Recent lightning observation count contributing to activity score.
  lightningRecentCount: { low: 0, high: 40 },
  // Significant wave height metres near Tuas / Singapore Strait.
  waveHeightM: { low: 0.5, high: 3.5 },
} as const;

// ── Estimated congestion sub-model — §13 ───────────────────────────────
export const CONGESTION_SUBWEIGHTS = {
  density: 0.4,
  slowMoving: 0.35,
  stationary: 0.25,
} as const;

export const CONGESTION_CONFIG = {
  // Density normalisation is expressed as a multiple of the scenario baseline
  // vessel count: at `lowMultiple`×baseline density scores 0, at
  // `highMultiple`×baseline it scores 100.
  densityLowMultiple: 0.5,
  densityHighMultiple: 2.0,
  // A vessel with SOG below this is "slow-moving" (knots).
  slowSpeedKnots: 3,
  // A vessel with SOG below this is "apparently stationary" (knots).
  stationarySpeedKnots: 0.5,
  // Status thresholds on the 0–100 congestion score.
  statusThresholds: { fluidMax: 33, elevatedMax: 66 },
} as const;

// ── Maritime disruption sub-model — §13 ────────────────────────────────
// Base severity scores (0–100) per category.
export const DISRUPTION_SEVERITY_SCORE: Record<DisruptionSeverity, number> = {
  low: 25,
  moderate: 50,
  high: 75,
  critical: 100,
};

export const DISRUPTION_CONFIG = {
  // Recency half-life in hours — a report's weight halves every N hours so old
  // reports decay instead of staying permanently critical.
  recencyHalfLifeHours: 36,
  // Extra points added per additional corroborating source, capped.
  corroborationBonusPerSource: 4,
  corroborationBonusCap: 12,
} as const;

// ── Cargo exposure sub-model (project cargo-priority policy) ───────────
// Base exposure by highest-priority cargo class present.
export const CARGO_BASE_EXPOSURE = {
  pharmaceuticals: 70,
  medical: 65,
  perishables: 55,
  industrial: 35,
  general: 25,
} as const;

export const CARGO_CONFIG = {
  coldChainBonus: 15,
  criticalityBonus: { low: 0, standard: 5, high: 15, critical: 25 },
  // Weight given to the simulator's inventory exposure score when present.
  inventoryExposureWeight: 0.4,
} as const;

// ── Confidence sub-model — §13 (distinct from risk) ────────────────────
export const CONFIDENCE_CONFIG = {
  // Confidence class thresholds on the 0–100 score.
  classThresholds: { lowMax: 39, mediumMax: 69 },
  // Status multipliers applied to each source's confidence contribution.
  statusFactor: {
    LIVE: 1.0,
    CACHED: 0.7,
    ESTIMATED: 0.6,
    SIMULATED: 0.5,
    UNAVAILABLE: 0.0,
  },
  // Minimum agreement factor even when sources disagree completely.
  minAgreementFactor: 0.6,
} as const;

// ── Freshness rules ────────────────────────────────────────────────────
// Multiples of a feed's expected-freshness window that bound each class.
export const FRESHNESS_CONFIG = {
  freshMultiple: 1, // age <= 1× expected  → FRESH
  recentMultiple: 2, // age <= 2× expected  → RECENT
  staleMultiple: 4, // age <= 4× expected  → STALE, beyond → EXPIRED
} as const;

// Default expected-freshness windows per feed (seconds).
export const EXPECTED_FRESHNESS_SECONDS = {
  weather: 15 * 60,
  lightning: 5 * 60,
  marine: 60 * 60,
  vessels: 5 * 60,
  disruptions: 6 * 60 * 60,
} as const;
