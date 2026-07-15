/** Definitions of every monitored data feed, used by diagnostics + confidence. */

import { EXPECTED_FRESHNESS_SECONDS } from "@/lib/risk/risk-config";

export interface FeedDefinition {
  key: FeedKey;
  label: string;
  sourceName: string;
  sourceUrl?: string;
  expectedFreshnessSeconds: number;
  /** 0..1 base reliability used by the confidence engine. */
  baseReliability: number;
  /** 0..1 geographic relevance to Tuas. */
  geographicRelevance: number;
}

export type FeedKey =
  | "weather"
  | "lightning"
  | "marine"
  | "vessels"
  | "disruptions";

export const FEEDS: Record<FeedKey, FeedDefinition> = {
  weather: {
    key: "weather",
    label: "Singapore weather (NEA / data.gov.sg)",
    sourceName: "data.gov.sg (NEA)",
    sourceUrl: "https://data.gov.sg",
    expectedFreshnessSeconds: EXPECTED_FRESHNESS_SECONDS.weather,
    baseReliability: 0.9,
    geographicRelevance: 0.8,
  },
  lightning: {
    key: "lightning",
    label: "Lightning observations",
    sourceName: "Singapore lightning observation source",
    expectedFreshnessSeconds: EXPECTED_FRESHNESS_SECONDS.lightning,
    baseReliability: 0.75,
    geographicRelevance: 0.85,
  },
  marine: {
    key: "marine",
    label: "Marine forecast (Open-Meteo Marine)",
    sourceName: "Open-Meteo Marine",
    sourceUrl: "https://open-meteo.com",
    expectedFreshnessSeconds: EXPECTED_FRESHNESS_SECONDS.marine,
    baseReliability: 0.7,
    geographicRelevance: 0.8,
  },
  vessels: {
    key: "vessels",
    label: "AIS vessel snapshot",
    sourceName: "AISStream (or demo)",
    sourceUrl: "https://aisstream.io",
    expectedFreshnessSeconds: EXPECTED_FRESHNESS_SECONDS.vessels,
    baseReliability: 0.65,
    geographicRelevance: 0.9,
  },
  disruptions: {
    key: "disruptions",
    label: "Maritime disruption search",
    sourceName: "Maritime news / GDELT / advisories",
    expectedFreshnessSeconds: EXPECTED_FRESHNESS_SECONDS.disruptions,
    baseReliability: 0.6,
    geographicRelevance: 0.6,
  },
};

export const FEED_KEYS = Object.keys(FEEDS) as FeedKey[];
