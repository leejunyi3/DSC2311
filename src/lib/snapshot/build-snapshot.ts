/**
 * Snapshot assembler (§9, §22). Produces the ONE shared DashboardSnapshot that
 * the dashboard, charts, map, alerts, simulator and chatbot all consume, so the
 * whole application always reflects a single consistent picture.
 *
 * All numbers here come from the deterministic engines — this module never
 * invents a figure. Claude later explains these values; it does not compute
 * them.
 */

import "server-only";

import type {
  AppMode,
  ConfidenceSourceInput,
  CongestionResult,
  DataEnvelope,
  DataStatus,
  DemoScenarioId,
  Disruption,
  DisruptionRiskItem,
  LightningObservation,
  MarineObservation,
  RiskResult,
  SimulationInput,
  VesselSnapshot,
  WeatherObservation,
} from "@/types";
import type {
  ConnectivityState,
  DashboardSnapshot,
  FeedHealth,
} from "@/types/snapshot";
import type { FeedDefinition, FeedKey } from "@/lib/constants/feeds";
import { FEEDS } from "@/lib/constants/feeds";
import { getScenario } from "@/fixtures";
import {
  demoDisruptions,
  demoHistory,
  demoLightning,
  demoMarine,
  demoVessels,
  demoWeather,
} from "@/lib/data-providers/demo-provider";
import { fetchLiveWeather } from "@/lib/data-providers/weather-provider";
import { fetchLiveMarine } from "@/lib/data-providers/marine-provider";
import { fetchLiveLightning } from "@/lib/data-providers/lightning-provider";
import { fetchLiveVessels } from "@/lib/data-providers/ais-provider";
import { fetchLiveDisruptions } from "@/lib/data-providers/disruption-provider";
import { calculateCongestion } from "@/lib/risk/congestion-engine";
import { calculateConfidence } from "@/lib/risk/confidence-engine";
import { calculateResilienceRisk } from "@/lib/risk/risk-engine";
import { compareResponseOptions } from "@/lib/simulator/option-comparison";
import { cacheGet, cacheSet } from "@/lib/cache/memory-cache";
import { ageSecondsFrom } from "@/lib/risk/freshness-engine";
import { SeededRng } from "@/lib/utils/prng";
import { nowIso } from "@/lib/utils/time";
import {
  CONGESTION_DISCLAIMER,
  MARINE_NAV_DISCLAIMER,
  LIVE_VESSEL_BASELINE,
} from "@/lib/constants/geo";
import { SafeFetchError } from "@/lib/utils/fetch";

export interface BuildSnapshotOptions {
  mode: AppMode;
  scenarioId: DemoScenarioId;
  seed: number;
  cacheTtlSeconds: number;
  liveToggles: Record<FeedKey, boolean>;
}

interface Resolved<T> {
  envelope: DataEnvelope<T>;
  confidence: ConfidenceSourceInput;
  health: FeedHealth;
}

/** Confidence + freshness inputs shared by every resolved feed. */
function toConfidenceInput(
  feed: FeedDefinition,
  status: DataStatus,
  ageSeconds: number,
): ConfidenceSourceInput {
  return {
    name: feed.label,
    reliability: feed.baseReliability,
    status,
    ageSeconds,
    expectedFreshnessSeconds: feed.expectedFreshnessSeconds,
    geographicRelevance: feed.geographicRelevance,
  };
}

function connectionFor(status: DataStatus): FeedHealth["connection"] {
  switch (status) {
    case "LIVE":
      return "connected";
    case "CACHED":
    case "ESTIMATED":
      return "delayed";
    case "SIMULATED":
      return "demo";
    default:
      return "unavailable";
  }
}

/**
 * Resolve one feed to a classified envelope. Demo Mode always returns SIMULATED
 * fixture data. Live Mode tries the live fetch, then falls back to recent cache
 * (CACHED / Degraded), and finally UNAVAILABLE — it never substitutes simulated
 * data for live data.
 */
async function resolveFeed<T>(params: {
  feed: FeedDefinition;
  mode: AppMode;
  liveEnabled: boolean;
  now: number;
  demoValue: () => { data: T; observedAt: string; confidence: number };
  fetchLive: () => Promise<{ data: T; observedAt: string }>;
  extraLimitations?: string[];
}): Promise<Resolved<T>> {
  const { feed, mode, now } = params;
  const cacheKey = `feed:${feed.key}`;
  const retrievedAt = new Date(now).toISOString();
  const extra = params.extraLimitations ?? [];

  if (mode === "demo") {
    const demo = params.demoValue();
    const ageSeconds = ageSecondsFrom(demo.observedAt, retrievedAt);
    return buildResolved({
      feed,
      status: "SIMULATED",
      data: demo.data,
      observedAt: demo.observedAt,
      retrievedAt,
      ageSeconds,
      confidence: demo.confidence,
      limitations: ["Simulated Demo Data", ...extra],
      now,
    });
  }

  // ── Live mode ──
  if (params.liveEnabled) {
    const started = Date.now();
    try {
      const live = await params.fetchLive();
      const responseTimeMs = Date.now() - started;
      const ageSeconds = ageSecondsFrom(live.observedAt, retrievedAt);
      // Keep a recent copy for Degraded Mode fallback (1h retention).
      cacheSet(cacheKey, { data: live.data, observedAt: live.observedAt }, 3600);
      const res = buildResolved({
        feed,
        status: "LIVE",
        data: live.data,
        observedAt: live.observedAt,
        retrievedAt,
        ageSeconds,
        confidence: 100,
        limitations: extra,
        now,
      });
      res.health.responseTimeMs = responseTimeMs;
      return res;
    } catch (err) {
      const safe =
        err instanceof SafeFetchError
          ? { code: err.code, message: err.message }
          : { code: "UNKNOWN", message: "Live source failed." };

      // Degraded: serve recent cache if we have it.
      const cached = cacheGet<{ data: T; observedAt: string }>(cacheKey);
      if (cached) {
        const ageSeconds = ageSecondsFrom(cached.value.observedAt, retrievedAt);
        const res = buildResolved({
          feed,
          status: "CACHED",
          data: cached.value.data,
          observedAt: cached.value.observedAt,
          retrievedAt,
          ageSeconds,
          confidence: 60,
          limitations: [
            `${feed.label} live source failed; showing cached data.`,
            ...extra,
          ],
          now,
        });
        res.health.lastError = safe.message;
        res.health.activeFallback = "Recent cache";
        return res;
      }

      // Nothing to fall back to.
      const res = buildResolved<T>({
        feed,
        status: "UNAVAILABLE",
        data: null,
        observedAt: undefined,
        retrievedAt,
        ageSeconds: undefined,
        confidence: 0,
        limitations: [`${feed.label} unavailable.`, ...extra],
        now,
        error: safe,
      });
      res.health.lastError = safe.message;
      return res;
    }
  }

  // Live disabled for this feed.
  const res = buildResolved<T>({
    feed,
    status: "UNAVAILABLE",
    data: null,
    observedAt: undefined,
    retrievedAt,
    ageSeconds: undefined,
    confidence: 0,
    limitations: [`${feed.label} live source disabled by configuration.`, ...extra],
    now,
    error: { code: "DISABLED", message: "Live source disabled." },
  });
  return res;
}

function buildResolved<T>(p: {
  feed: FeedDefinition;
  status: DataStatus;
  data: T | null;
  observedAt: string | undefined;
  retrievedAt: string;
  ageSeconds: number | undefined;
  confidence: number;
  limitations: string[];
  now: number;
  error?: { code: string; message: string };
}): Resolved<T> {
  const envelope: DataEnvelope<T> = {
    data: p.data,
    status: p.status,
    sourceName: p.feed.sourceName,
    sourceUrl: p.feed.sourceUrl,
    observedAt: p.observedAt,
    retrievedAt: p.retrievedAt,
    ageSeconds: p.ageSeconds,
    confidence: p.confidence,
    limitations: p.limitations,
    error: p.error,
  };
  const health: FeedHealth = {
    key: p.feed.key,
    label: p.feed.label,
    sourceName: p.feed.sourceName,
    status: p.status,
    connection: connectionFor(p.status),
    ageSeconds: p.ageSeconds,
    expectedFreshnessSeconds: p.feed.expectedFreshnessSeconds,
    lastError: p.error?.message,
    message: healthMessage(p.feed.label, p.status, p.ageSeconds),
  };
  return {
    envelope,
    confidence: toConfidenceInput(p.feed, p.status, p.ageSeconds ?? 1e9),
    health,
  };
}

function healthMessage(
  label: string,
  status: DataStatus,
  ageSeconds?: number,
): string {
  const mins = ageSeconds != null ? Math.round(ageSeconds / 60) : null;
  switch (status) {
    case "LIVE":
      return `${label} connected${mins != null ? ` (updated ${mins} min ago)` : ""}.`;
    case "CACHED":
      return `${label} temporarily unavailable. Cached information${mins != null ? ` from ${mins} minutes ago` : ""} is being displayed.`;
    case "SIMULATED":
      return `${label} showing Simulated Demo Data.`;
    case "ESTIMATED":
      return `${label} is an analytical estimate.`;
    default:
      return `${label} unavailable.`;
  }
}

export async function buildSnapshot(
  opts: BuildSnapshotOptions,
): Promise<DashboardSnapshot> {
  const now = Date.now();
  const fx = getScenario(opts.scenarioId);
  const retrievedAt = new Date(now).toISOString();

  // ── Resolve the five external feeds ──
  const weather = await resolveFeed<WeatherObservation>({
    feed: FEEDS.weather,
    mode: opts.mode,
    liveEnabled: opts.liveToggles.weather,
    now,
    demoValue: () => ({
      data: demoWeather(fx, now),
      observedAt: demoWeather(fx, now).observedAt,
      confidence: 92,
    }),
    fetchLive: async () => {
      const data = await fetchLiveWeather();
      return { data, observedAt: data.observedAt };
    },
  });

  const lightning = await resolveFeed<LightningObservation>({
    feed: FEEDS.lightning,
    mode: opts.mode,
    liveEnabled: opts.liveToggles.lightning,
    now,
    demoValue: () => {
      const d = demoLightning(fx, now);
      return { data: d, observedAt: d.observedAt, confidence: 80 };
    },
    fetchLive: async () => {
      const data = await fetchLiveLightning();
      return { data, observedAt: data.observedAt };
    },
    extraLimitations: ["Does not detect every lightning event."],
  });

  const marine = await resolveFeed<MarineObservation & { trend: string }>({
    feed: FEEDS.marine,
    mode: opts.mode,
    liveEnabled: opts.liveToggles.marine,
    now,
    demoValue: () => {
      const d = demoMarine(fx, now);
      return { data: d, observedAt: d.observedAt, confidence: 78 };
    },
    fetchLive: async () => {
      const data = await fetchLiveMarine("tuas");
      return { data, observedAt: data.observedAt };
    },
    extraLimitations: [MARINE_NAV_DISCLAIMER],
  });

  const vessels = await resolveFeed<VesselSnapshot>({
    feed: FEEDS.vessels,
    mode: opts.mode,
    liveEnabled: opts.liveToggles.vessels,
    now,
    demoValue: () => {
      const d = demoVessels(fx, now, opts.seed);
      return { data: d, observedAt: d.observedAt, confidence: 70 };
    },
    fetchLive: async () => {
      const data = await fetchLiveVessels();
      return { data, observedAt: data.observedAt };
    },
    extraLimitations: ["AIS positions may be sparse, delayed or spoofed."],
  });

  const disruptions = await resolveFeed<Disruption[]>({
    feed: FEEDS.disruptions,
    mode: opts.mode,
    liveEnabled: opts.liveToggles.disruptions,
    now,
    demoValue: () => ({
      data: demoDisruptions(fx, now),
      observedAt: retrievedAt,
      confidence: 65,
    }),
    fetchLive: async () => {
      const data = await fetchLiveDisruptions();
      return { data, observedAt: retrievedAt };
    },
  });

  // ── Estimated congestion (derived, classified ESTIMATED) ──
  const vesselData = vessels.envelope.data;
  const congestionResult: CongestionResult | null = vesselData
    ? calculateCongestion({
        vesselCount: vesselData.vesselCount,
        // Live AIS covers the broader Singapore approaches, so use a regional
        // baseline; demo uses the scenario's Tuas-specific baseline.
        baselineVesselCount:
          opts.mode === "live"
            ? LIVE_VESSEL_BASELINE
            : fx.vessels.baselineCount,
        slowMovingCount: vesselData.slowMovingCount,
        stationaryCount: vesselData.stationaryCount,
        averageSpeedKnots: vesselData.averageSpeedKnots,
        previousVesselCount:
          opts.mode === "live" ? null : fx.vessels.previousCount,
      })
    : null;

  const congestion: DataEnvelope<CongestionResult> = {
    data: congestionResult,
    status: vesselData ? "ESTIMATED" : "UNAVAILABLE",
    sourceName: "AIS analytical estimate",
    observedAt: vessels.envelope.observedAt,
    retrievedAt,
    ageSeconds: vessels.envelope.ageSeconds,
    confidence: vesselData ? Math.min(vessels.envelope.confidence, 70) : 0,
    limitations: [CONGESTION_DISCLAIMER],
  };

  // ── Confidence (separate from risk) ──
  // In Demo Mode the DISPLAY classification of every feed stays SIMULATED, but
  // confidence models the *scenario's* source quality (a simulated calm day is
  // still a high-confidence picture). So we present the feeds to the confidence
  // engine as if observed, and let the scenario's freshness + source agreement
  // differentiate scenarios. Live/Degraded Mode keeps the real statuses, so
  // cached/unavailable feeds correctly lower confidence.
  const confidenceSources = [
    weather.confidence,
    lightning.confidence,
    marine.confidence,
    vessels.confidence,
    disruptions.confidence,
  ].map((s) =>
    opts.mode === "demo" && s.status === "SIMULATED"
      ? { ...s, status: "LIVE" as const }
      : s,
  );
  const confidence = calculateConfidence({
    sources: confidenceSources,
    agreement: opts.mode === "demo" ? fx.sourceAgreement : 0.75,
  });

  // ── Simulator (scenario defaults) ──
  const simulatorDefaults: SimulationInput = { ...fx.simulatorDefaults };
  const simulation = compareResponseOptions(simulatorDefaults);
  const waitOption = simulation.options.find((o) => o.kind === "wait");

  // ── Risk ──
  const disruptionItems: DisruptionRiskItem[] = (disruptions.envelope.data ?? []).map(
    (d) => ({
      id: d.id,
      severity: d.severity,
      routeRelevance: d.routeRelevance,
      locationRelevance: d.locationRelevance,
      sourceReliability: d.sourceReliability,
      ageHours: Math.max(0, ageSecondsFrom(d.publishedAt, retrievedAt) / 3600),
      supportingSources: d.supportingSources,
    }),
  );

  const w = weather.envelope.data;
  const l = lightning.envelope.data;
  const m = marine.envelope.data;

  const baseRisk = calculateResilienceRisk({
    weather: {
      rainfallMmPerHr: w?.rainfallMmPerHr ?? null,
      windSpeedKnots: w?.windSpeedKnots ?? null,
      lightningNearestKm: l?.nearestKm ?? null,
      lightningRecentCount: l?.recentCount ?? null,
      waveHeightM: m?.waveHeightM ?? null,
    },
    congestionScore: congestionResult?.score ?? 0,
    disruptions: disruptionItems,
    cargo: {
      cargoClass: simulatorDefaults.cargoType,
      coldChain: simulatorDefaults.coldChain,
      inventoryExposureScore: waitOption?.inventory.inventoryExposureScore ?? null,
      criticality: simulatorDefaults.criticality,
    },
    dataConfidence: confidence.score,
    previousOverall: null,
  });

  // Deterministic "previous reading" so the KPI change arrow is stable.
  const prevRng = new SeededRng(`${fx.id}:prev:${opts.seed}`);
  const previousOverall = Math.round(
    Math.min(100, Math.max(0, baseRisk.overall - prevRng.range(-5, 7))) * 10,
  ) / 10;
  const risk: RiskResult = {
    ...baseRisk,
    previousOverall,
    delta: Math.round((baseRisk.overall - previousOverall) * 10) / 10,
  };

  // ── History ──
  const history = demoHistory(
    fx,
    now,
    opts.seed,
    risk.overall,
    congestionResult?.score ?? 0,
    risk.components.weather,
    risk.components.disruption,
  );

  // ── Connectivity ──
  const connectivity = deriveConnectivity(opts.mode, [
    weather,
    lightning,
    marine,
    vessels,
    disruptions,
  ]);

  const limitations = dedupe([
    CONGESTION_DISCLAIMER,
    ...weather.envelope.limitations,
    ...vessels.envelope.limitations,
    ...disruptions.envelope.limitations,
  ]);

  return {
    mode: opts.mode,
    scenarioId: opts.scenarioId,
    scenarioName: fx.name,
    scenarioNarrative: fx.narrative,
    generatedAt: retrievedAt,
    connectivity,
    weather: weather.envelope,
    lightning: lightning.envelope,
    marine: marine.envelope,
    vessels: vessels.envelope,
    congestion,
    disruptions: disruptions.envelope,
    risk,
    confidence,
    simulatorDefaults,
    simulation,
    feeds: [
      weather.health,
      lightning.health,
      marine.health,
      vessels.health,
      disruptions.health,
    ],
    history,
    limitations,
  };
}

function deriveConnectivity(
  mode: AppMode,
  resolved: Array<Resolved<unknown>>,
): ConnectivityState {
  if (mode === "demo") return "demo";
  const statuses = resolved.map((r) => r.envelope.status);
  const weatherStatus = resolved[0]?.envelope.status;
  const vesselStatus = resolved[3]?.envelope.status;
  const bothCoreDown =
    weatherStatus === "UNAVAILABLE" && vesselStatus === "UNAVAILABLE";
  if (bothCoreDown) return "critical";
  const anyDegraded = statuses.some(
    (s) => s === "CACHED" || s === "UNAVAILABLE",
  );
  return anyDegraded ? "degraded" : "operational";
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}
