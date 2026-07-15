/**
 * Marine forecast provider (§11). LIVE path uses the keyless, documented
 * Open-Meteo Marine API. Output is always a FORECAST, never a live observation,
 * and must not be used for vessel navigation.
 *
 * Live docs: https://open-meteo.com/en/docs/marine-weather-api
 */

import type { MarineObservation } from "@/types";
import { openMeteoMarineSchema } from "@/lib/schemas/providers";
import { safeFetchJson, SafeFetchError } from "@/lib/utils/fetch";
import { MARINE_LOCATIONS, type MarineLocationKey } from "@/lib/constants/geo";

const BASE = "https://marine-api.open-meteo.com/v1/marine";

export async function fetchLiveMarine(
  location: MarineLocationKey = "tuas",
  signal?: AbortSignal,
): Promise<MarineObservation & { trend: string }> {
  const loc = MARINE_LOCATIONS[location];
  const url =
    `${BASE}?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&current=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction` +
    `&hourly=wave_height&timezone=Asia%2FSingapore`;

  const json = await safeFetchJson<unknown>(url, {
    timeoutMs: 7000,
    retries: 1,
    signal,
  });
  const parsed = openMeteoMarineSchema.parse(json);
  const cur = parsed.current;
  if (!cur) {
    throw new SafeFetchError(
      "MARINE_UNAVAILABLE",
      "Marine forecast dataset unavailable.",
    );
  }

  // Derive a simple trend from the next few hourly wave-height samples.
  const trend = deriveTrend(parsed.hourly?.wave_height ?? []);

  return {
    waveHeightM: cur.wave_height ?? null,
    waveDirectionDegrees: cur.wave_direction ?? null,
    wavePeriodS: cur.wave_period ?? null,
    windWaveHeightM: cur.wind_wave_height ?? null,
    swellHeightM: cur.swell_wave_height ?? null,
    swellDirectionDegrees: cur.swell_wave_direction ?? null,
    locationName: loc.label,
    isForecast: true,
    observedAt: new Date(cur.time).toISOString(),
    trend,
  };
}

function deriveTrend(series: Array<number | null>): string {
  const vals = series.filter((v): v is number => v != null).slice(0, 6);
  if (vals.length < 2) return "stable";
  const first = vals[0]!;
  const last = vals[vals.length - 1]!;
  const delta = last - first;
  if (delta > 0.2) return "deteriorating";
  if (delta < -0.2) return "improving";
  return "stable";
}
