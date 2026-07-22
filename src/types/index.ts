/**
 * Core domain and data-classification types for the Tuas Mega Port
 * Resilience Control Tower.
 *
 * Every value that flows through the application carries an explicit data
 * classification so the UI, the risk engine and the Claude assistant can never
 * silently present simulated or stale data as live. See §10 of BUILD_SPEC.md.
 */

// ── Data classification ────────────────────────────────────────────────

export type DataStatus =
  | "LIVE"
  | "CACHED"
  | "ESTIMATED"
  | "SIMULATED"
  | "UNAVAILABLE";

export interface DataEnvelopeError {
  code: string;
  message: string;
}

/**
 * A transparent wrapper around every external / derived data point. `data` is
 * `null` whenever `status` is `UNAVAILABLE`. `confidence` is 0–100.
 */
export interface DataEnvelope<T> {
  data: T | null;
  status: DataStatus;
  sourceName: string;
  sourceUrl?: string;
  /** ISO timestamp the underlying observation was made (source clock). */
  observedAt?: string;
  /** ISO timestamp we retrieved / computed this envelope. */
  retrievedAt: string;
  /** Age of the observation in seconds at retrieval time. */
  ageSeconds?: number;
  confidence: number;
  limitations: string[];
  error?: DataEnvelopeError;
}

// ── Application modes ──────────────────────────────────────────────────

export type AppMode = "live" | "degraded" | "demo";

export type DemoScenarioId =
  | "normal-operations"
  | "thunderstorm"
  | "regional-disruption"
  | "pharmaceutical-crisis";

// ── Freshness ──────────────────────────────────────────────────────────

export type FreshnessClass = "FRESH" | "RECENT" | "STALE" | "EXPIRED";

export interface FreshnessResult {
  class: FreshnessClass;
  ageSeconds: number;
  expectedFreshnessSeconds: number;
  /** 0..1 multiplier used to discount confidence for aging data. */
  factor: number;
}

// ── Risk ───────────────────────────────────────────────────────────────

export type RiskCategory = "Low" | "Moderate" | "High" | "Critical";

/** Normalised (0–100) inputs to the weather sub-model. `null` = unavailable. */
export interface WeatherRiskInput {
  rainfallMmPerHr: number | null;
  windSpeedKnots: number | null;
  /** Distance in km to nearest recent lightning observation. */
  lightningNearestKm: number | null;
  /** Count of recent lightning observations inside the monitoring window. */
  lightningRecentCount: number | null;
  waveHeightM: number | null;
}

export interface CongestionInput {
  vesselCount: number;
  baselineVesselCount: number;
  slowMovingCount: number;
  stationaryCount: number;
  averageSpeedKnots: number;
  /** Optional previous reading for change-over-time. */
  previousVesselCount?: number | null;
}

export type CongestionStatus = "Fluid" | "Elevated" | "Severe";

export interface CongestionResult {
  score: number;
  status: CongestionStatus;
  normalisedDensity: number;
  slowMovingRatio: number;
  stationaryRatio: number;
  averageSpeedKnots: number;
  vesselCount: number;
  slowMovingCount: number;
  stationaryCount: number;
  deltaVesselCount: number | null;
  breakdown: {
    densityComponent: number;
    slowComponent: number;
    stationaryComponent: number;
  };
}

export type DisruptionSeverity = "low" | "moderate" | "high" | "critical";

/** A single maritime disruption reduced to the fields the risk model needs. */
export interface DisruptionRiskItem {
  id: string;
  severity: DisruptionSeverity;
  /** 0..1 — relevance of the affected route to Tuas flows. */
  routeRelevance: number;
  /** 0..1 — geographic relevance to the monitoring area. */
  locationRelevance: number;
  /** 0..1 — reliability of the reporting source. */
  sourceReliability: number;
  ageHours: number;
  supportingSources: number;
}

export interface CargoExposureInput {
  /** Highest-priority cargo class present in the current context. */
  cargoClass: CargoClass;
  coldChain: boolean;
  /** 0–100 inventory exposure from the simulator, when available. */
  inventoryExposureScore: number | null;
  criticality: ShipmentCriticality;
}

export interface RiskComponents {
  weather: number;
  congestion: number;
  disruption: number;
  cargo: number;
  dataQualityPenalty: number;
}

export interface RiskDriver {
  label: string;
  /** Weighted contribution to the overall score, in points. */
  contribution: number;
  component: keyof RiskComponents;
}

export interface RiskResult {
  overall: number;
  category: RiskCategory;
  components: RiskComponents;
  /** Weighted point contributions (component score × weight). */
  weightedContributions: RiskComponents;
  drivers: RiskDriver[];
  previousOverall: number | null;
  delta: number | null;
}

// ── Confidence ─────────────────────────────────────────────────────────

export type ConfidenceClass = "High" | "Medium" | "Low";

export interface ConfidenceSourceInput {
  name: string;
  /** 0..1 base reliability of the source. */
  reliability: number;
  status: DataStatus;
  ageSeconds: number;
  expectedFreshnessSeconds: number;
  /** 0..1 geographic relevance to Tuas. */
  geographicRelevance: number;
}

export interface ConfidenceResult {
  score: number;
  class: ConfidenceClass;
  availableFeeds: number;
  totalFeeds: number;
  staleFeeds: string[];
  unavailableFeeds: string[];
  /** 0..1 agreement factor between sources that was applied. */
  agreement: number;
  mainLimitation: string;
}

// ── Cargo / simulator ──────────────────────────────────────────────────

export type CargoClass =
  | "general"
  | "perishables"
  | "pharmaceuticals"
  | "industrial"
  | "medical";

export type ShipmentCriticality = "low" | "standard" | "high" | "critical";

export type CustomerPriority = "standard" | "priority" | "key-account";

export type AlternativeKind =
  | "wait"
  | "tanjung-pelepas"
  | "port-klang"
  | "johor-pasir-gudang"
  | "batam"
  | "penang"
  | "jurong-port"
  | "airfreight-changi"
  | "custom";

export interface SimulationInput {
  cargoType: CargoClass;
  criticality: ShipmentCriticality;
  coldChain: boolean;
  safetyStockDays: number;
  dailyDemand: number;
  expectedDelayHours: number;
  unitShortageCost: number;
  /** Alternative route / port config. */
  alternativeKind: AlternativeKind;
  alternativeTransitHours: number;
  additionalHandlingHours: number;
  additionalReroutingCost: number;
  customerPriority: CustomerPriority;
  emergencyReplenishmentQty: number;
  emergencyReplenishmentLeadHours: number;
  emergencyReplenishmentCost: number;
}

export type ColdChainExposure = "none" | "monitor" | "elevated" | "critical";
export type ServiceLevelRisk = "low" | "moderate" | "high" | "critical";

export interface InventoryResult {
  effectiveDelayHours: number;
  effectiveDelayDays: number;
  remainingCoverageDays: number;
  coverageGapDays: number;
  potentialShortageUnits: number;
  inventoryExposureScore: number;
  potentialShortageCost: number;
  totalScenarioCost: number;
  coldChainExposure: ColdChainExposure;
  serviceLevelRisk: ServiceLevelRisk;
}

export interface ResponseOption {
  kind: AlternativeKind;
  label: string;
  /** Effective delay this option incurs, in hours. */
  delayHours: number;
  inventory: InventoryResult;
  /** Extra, human-readable notes (assumptions specific to this option). */
  notes: string[];
}

export interface OptionComparisonResult {
  options: ResponseOption[];
  recommendedKind: AlternativeKind;
  recommendationReason: string;
  assumptions: string[];
  requiresHumanApproval: boolean;
}

// ── Vessels / weather / marine observations ────────────────────────────

export type VesselMotion = "normal" | "slow" | "stationary";

export interface Vessel {
  mmsi: string;
  name: string;
  lat: number;
  lon: number;
  speedKnots: number;
  courseDegrees: number | null;
  headingDegrees: number | null;
  vesselType: string;
  lastReceivedAt: string;
  motion: VesselMotion;
}

export interface VesselSnapshot {
  vessels: Vessel[];
  vesselCount: number;
  slowMovingCount: number;
  stationaryCount: number;
  averageSpeedKnots: number;
  observedAt: string;
}

export interface WeatherObservation {
  rainfallMmPerHr: number | null;
  windSpeedKnots: number | null;
  windDirectionDegrees: number | null;
  temperatureC: number | null;
  relativeHumidityPct: number | null;
  stationName: string;
  observedAt: string;
}

export interface LightningObservation {
  recentCount: number;
  nearestKm: number | null;
  observedAt: string;
}

export interface MarineObservation {
  waveHeightM: number | null;
  waveDirectionDegrees: number | null;
  wavePeriodS: number | null;
  windWaveHeightM: number | null;
  swellHeightM: number | null;
  swellDirectionDegrees: number | null;
  locationName: string;
  /** Marine data is a forecast, never a live navigation observation. */
  isForecast: true;
  observedAt: string;
}

export interface Disruption {
  id: string;
  title: string;
  event: string;
  location: string;
  source: string;
  sourceCategory: string;
  publishedAt: string;
  retrievedAt: string;
  summary: string;
  severity: DisruptionSeverity;
  routeRelevance: number;
  locationRelevance: number;
  sourceReliability: number;
  supportingSources: number;
  operationalImpact: string;
  supplyChainImpact: string;
  suggestedResponse: string;
  confidence: number;
  status: DataStatus;
  url?: string;
  active: boolean;
}
