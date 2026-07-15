/**
 * Shape of a deterministic demo scenario fixture (§26). Fixtures store scenario
 * *values* plus RELATIVE ages (minutes). The demo provider stamps real
 * timestamps at snapshot time (now − ageMinutes) so freshness looks realistic
 * while every underlying value stays deterministic and seed-driven.
 */

import type {
  CargoClass,
  CustomerPriority,
  DemoScenarioId,
  DisruptionSeverity,
  ShipmentCriticality,
  AlternativeKind,
} from "@/types";

export interface FixtureWeather {
  rainfallMmPerHr: number;
  windSpeedKnots: number;
  windDirectionDegrees: number;
  temperatureC: number;
  relativeHumidityPct: number;
  stationName: string;
  ageMinutes: number;
}

export interface FixtureLightning {
  recentCount: number;
  nearestKm: number | null;
  ageMinutes: number;
}

export interface FixtureMarine {
  waveHeightM: number;
  waveDirectionDegrees: number;
  wavePeriodS: number;
  windWaveHeightM: number;
  swellHeightM: number;
  swellDirectionDegrees: number;
  trend: "improving" | "stable" | "deteriorating";
  locationName: string;
  ageMinutes: number;
}

export interface FixtureVessels {
  count: number;
  baselineCount: number;
  slowMovingCount: number;
  stationaryCount: number;
  averageSpeedKnots: number;
  previousCount: number;
  ageMinutes: number;
}

export interface FixtureDisruption {
  id: string;
  title: string;
  event: string;
  location: string;
  source: string;
  sourceCategory: string;
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
  ageHours: number;
  active: boolean;
  url?: string;
}

export interface FixtureSimulatorDefaults {
  cargoType: CargoClass;
  criticality: ShipmentCriticality;
  coldChain: boolean;
  safetyStockDays: number;
  dailyDemand: number;
  expectedDelayHours: number;
  unitShortageCost: number;
  alternativeKind: AlternativeKind;
  alternativeTransitHours: number;
  additionalHandlingHours: number;
  additionalReroutingCost: number;
  customerPriority: CustomerPriority;
  emergencyReplenishmentQty: number;
  emergencyReplenishmentLeadHours: number;
  emergencyReplenishmentCost: number;
}

export interface ScenarioFixture {
  id: DemoScenarioId;
  name: string;
  description: string;
  narrative: string;
  weather: FixtureWeather;
  lightning: FixtureLightning;
  marine: FixtureMarine;
  vessels: FixtureVessels;
  disruptions: FixtureDisruption[];
  simulatorDefaults: FixtureSimulatorDefaults;
  /** Source-agreement factor (0..1) used by the confidence engine in demo. */
  sourceAgreement: number;
}
