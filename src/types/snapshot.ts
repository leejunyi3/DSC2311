/**
 * The single shared dataset (§9). The dashboard KPI cards, charts, map, alerts,
 * simulator summary and the chatbot ALL read from one DashboardSnapshot for a
 * given (mode, scenario) so they can never drift apart.
 */

import type {
  AppMode,
  ConfidenceResult,
  CongestionResult,
  DataEnvelope,
  DemoScenarioId,
  Disruption,
  LightningObservation,
  MarineObservation,
  OptionComparisonResult,
  RiskResult,
  SimulationInput,
  VesselSnapshot,
  WeatherObservation,
} from "@/types";
import type { FeedKey } from "@/lib/constants/feeds";

export type ConnectivityState =
  | "operational"
  | "degraded"
  | "demo"
  | "critical";

export interface FeedHealth {
  key: FeedKey;
  label: string;
  sourceName: string;
  status: DataEnvelope<unknown>["status"];
  connection: "connected" | "delayed" | "unavailable" | "demo";
  ageSeconds?: number;
  expectedFreshnessSeconds: number;
  responseTimeMs?: number;
  lastError?: string;
  activeFallback?: string;
  message: string;
}

export interface HistoryPoint {
  /** ISO timestamp of this sample. */
  t: string;
  overallRisk: number;
  weatherRisk: number;
  congestionRisk: number;
  disruptionRisk: number;
  vesselCount: number;
  slowMovingCount: number;
  stationaryCount: number;
  congestionScore: number;
  rainfallMmPerHr: number;
  windSpeedKnots: number;
  waveHeightM: number;
  lightningRiskIndicator: number;
}

export interface DashboardSnapshot {
  mode: AppMode;
  scenarioId: DemoScenarioId;
  scenarioName: string;
  scenarioNarrative: string;
  generatedAt: string;
  connectivity: ConnectivityState;

  weather: DataEnvelope<WeatherObservation>;
  lightning: DataEnvelope<LightningObservation>;
  marine: DataEnvelope<MarineObservation & { trend: string }>;
  vessels: DataEnvelope<VesselSnapshot>;
  congestion: DataEnvelope<CongestionResult>;
  disruptions: DataEnvelope<Disruption[]>;

  risk: RiskResult;
  confidence: ConfidenceResult;

  /** Default simulator inputs for the scenario + a pre-computed comparison. */
  simulatorDefaults: SimulationInput;
  simulation: OptionComparisonResult;

  feeds: FeedHealth[];
  history: HistoryPoint[];

  limitations: string[];
}
