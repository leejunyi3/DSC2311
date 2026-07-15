/**
 * Deterministic demo provider (§9, §26, §33.4). Expands a scenario fixture into
 * fully-typed observations, vessel positions, disruptions and chart history.
 * Everything is seeded by `DEMO_SEED` + the scenario id — NO `Math.random()` —
 * so every render, chart, marker and chatbot answer is identical for the same
 * inputs. All outputs are classified SIMULATED upstream.
 */

import type {
  Disruption,
  LightningObservation,
  MarineObservation,
  Vessel,
  VesselSnapshot,
  WeatherObservation,
} from "@/types";
import type { ScenarioFixture } from "@/types/fixtures";
import type { HistoryPoint } from "@/types/snapshot";
import { SeededRng } from "@/lib/utils/prng";
import { CONGESTION_CONFIG } from "@/lib/risk/risk-config";
import { AIS_BOUNDING_BOX } from "@/lib/constants/geo";

const VESSEL_TYPES = [
  "Container",
  "Bulk Carrier",
  "Tanker",
  "Cargo",
  "Tug",
] as const;

const isoMinutesAgo = (now: number, minutes: number): string =>
  new Date(now - minutes * 60_000).toISOString();

const isoHoursAgo = (now: number, hours: number): string =>
  new Date(now - hours * 3_600_000).toISOString();

export function demoWeather(
  fx: ScenarioFixture,
  now: number,
): WeatherObservation {
  return {
    rainfallMmPerHr: fx.weather.rainfallMmPerHr,
    windSpeedKnots: fx.weather.windSpeedKnots,
    windDirectionDegrees: fx.weather.windDirectionDegrees,
    temperatureC: fx.weather.temperatureC,
    relativeHumidityPct: fx.weather.relativeHumidityPct,
    stationName: fx.weather.stationName,
    observedAt: isoMinutesAgo(now, fx.weather.ageMinutes),
  };
}

export function demoLightning(
  fx: ScenarioFixture,
  now: number,
): LightningObservation {
  return {
    recentCount: fx.lightning.recentCount,
    nearestKm: fx.lightning.nearestKm,
    observedAt: isoMinutesAgo(now, fx.lightning.ageMinutes),
  };
}

export function demoMarine(
  fx: ScenarioFixture,
  now: number,
): MarineObservation & { trend: string } {
  return {
    waveHeightM: fx.marine.waveHeightM,
    waveDirectionDegrees: fx.marine.waveDirectionDegrees,
    wavePeriodS: fx.marine.wavePeriodS,
    windWaveHeightM: fx.marine.windWaveHeightM,
    swellHeightM: fx.marine.swellHeightM,
    swellDirectionDegrees: fx.marine.swellDirectionDegrees,
    locationName: fx.marine.locationName,
    isForecast: true,
    observedAt: isoMinutesAgo(now, fx.marine.ageMinutes),
    trend: fx.marine.trend,
  };
}

export function demoVessels(
  fx: ScenarioFixture,
  now: number,
  seed: number,
): VesselSnapshot {
  const rng = new SeededRng(`${fx.id}:vessels:${seed}`);
  const [[latMin, lonMin], [latMax, lonMax]] = AIS_BOUNDING_BOX;
  const total = fx.vessels.count;
  const stationary = Math.min(total, fx.vessels.stationaryCount);
  const slow = Math.min(total - stationary, fx.vessels.slowMovingCount);

  const vessels: Vessel[] = [];
  for (let i = 0; i < total; i++) {
    let motion: Vessel["motion"];
    let speed: number;
    if (i < stationary) {
      motion = "stationary";
      speed = rng.range(0, CONGESTION_CONFIG.stationarySpeedKnots);
    } else if (i < stationary + slow) {
      motion = "slow";
      speed = rng.range(
        CONGESTION_CONFIG.stationarySpeedKnots,
        CONGESTION_CONFIG.slowSpeedKnots,
      );
    } else {
      motion = "normal";
      speed = rng.range(5, 13);
    }

    const heading = rng.int(0, 359);
    vessels.push({
      mmsi: String(563000000 + rng.int(1, 999999)),
      name: `DEMO ${fx.id.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
      lat: Number(rng.range(latMin, latMax).toFixed(5)),
      lon: Number(rng.range(lonMin, lonMax).toFixed(5)),
      speedKnots: Number(speed.toFixed(1)),
      courseDegrees: motion === "stationary" ? null : heading,
      headingDegrees: heading,
      vesselType: rng.pick(VESSEL_TYPES),
      lastReceivedAt: isoMinutesAgo(now, rng.range(0, fx.vessels.ageMinutes + 3)),
      motion,
    });
  }

  return {
    vessels,
    vesselCount: total,
    slowMovingCount: slow,
    stationaryCount: stationary,
    averageSpeedKnots: fx.vessels.averageSpeedKnots,
    observedAt: isoMinutesAgo(now, fx.vessels.ageMinutes),
  };
}

export function demoDisruptions(fx: ScenarioFixture, now: number): Disruption[] {
  return fx.disruptions.map((d) => ({
    id: d.id,
    title: d.title,
    event: d.event,
    location: d.location,
    source: d.source,
    sourceCategory: d.sourceCategory,
    publishedAt: isoHoursAgo(now, d.ageHours),
    retrievedAt: new Date(now).toISOString(),
    summary: d.summary,
    severity: d.severity,
    routeRelevance: d.routeRelevance,
    locationRelevance: d.locationRelevance,
    sourceReliability: d.sourceReliability,
    supportingSources: d.supportingSources,
    operationalImpact: d.operationalImpact,
    supplyChainImpact: d.supplyChainImpact,
    suggestedResponse: d.suggestedResponse,
    confidence: d.confidence,
    status: "SIMULATED",
    url: d.url,
    active: d.active,
  }));
}

/**
 * Deterministic 7-day hourly history that eases from a calm baseline toward the
 * scenario's current values at the most recent sample. The UI slices the last
 * 6h / 24h / 7d from this single series.
 */
export function demoHistory(
  fx: ScenarioFixture,
  now: number,
  seed: number,
  currentOverallRisk: number,
  currentCongestionScore: number,
  currentWeatherRisk: number,
  currentDisruptionRisk: number,
): HistoryPoint[] {
  const rng = new SeededRng(`${fx.id}:history:${seed}`);
  const points: HistoryPoint[] = [];
  const HOURS = 168; // 7 days

  for (let h = HOURS; h >= 0; h--) {
    // ramp: 0 at the oldest sample, 1 at the newest.
    const ramp = (HOURS - h) / HOURS;
    const eased = ramp * ramp; // quadratic ease-in toward current values
    const jitter = (scale: number) => (rng.float() - 0.5) * scale;

    const baseCalm = 12;
    const overall = clampNum(
      baseCalm + (currentOverallRisk - baseCalm) * eased + jitter(4),
    );
    const congestionScore = clampNum(
      20 + (currentCongestionScore - 20) * eased + jitter(5),
    );
    const weatherRisk = clampNum(
      8 + (currentWeatherRisk - 8) * eased + jitter(6),
    );
    const disruptionRisk = clampNum(
      (currentDisruptionRisk) * eased + jitter(3),
    );

    const vesselCount = Math.round(
      fx.vessels.baselineCount +
        (fx.vessels.count - fx.vessels.baselineCount) * eased +
        jitter(4),
    );
    const slow = Math.round(fx.vessels.slowMovingCount * eased + jitter(2));
    const stationary = Math.round(
      fx.vessels.stationaryCount * eased + Math.abs(jitter(1)),
    );

    points.push({
      t: isoHoursAgo(now, h),
      overallRisk: overall,
      weatherRisk,
      congestionRisk: congestionScore,
      disruptionRisk,
      vesselCount: Math.max(0, vesselCount),
      slowMovingCount: Math.max(0, slow),
      stationaryCount: Math.max(0, stationary),
      congestionScore,
      rainfallMmPerHr: clampPos(fx.weather.rainfallMmPerHr * eased + jitter(2)),
      windSpeedKnots: clampPos(
        6 + (fx.weather.windSpeedKnots - 6) * eased + jitter(3),
      ),
      waveHeightM: clampPos(
        0.4 + (fx.marine.waveHeightM - 0.4) * eased + jitter(0.3),
        4,
      ),
      lightningRiskIndicator: clampNum(
        (fx.lightning.recentCount > 0 ? 60 : 0) * eased + jitter(5),
      ),
    });
  }
  return points;
}

function clampNum(v: number): number {
  return Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
}
function clampPos(v: number, max = 200): number {
  return Math.round(Math.min(max, Math.max(0, v)) * 10) / 10;
}
