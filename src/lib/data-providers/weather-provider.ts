/**
 * Singapore weather provider (§11). LIVE path uses the keyless, documented
 * data.gov.sg (NEA) realtime environment endpoints and selects the station
 * nearest to the Tuas monitoring point. Island-wide datasets are attributed by
 * their actual station, never relabelled as a Tuas-specific sensor.
 *
 * Live docs: https://data.gov.sg/  (v1 /environment/* realtime readings)
 */

import type { WeatherObservation } from "@/types";
import { neaEnvironmentReadingSchema } from "@/lib/schemas/providers";
import { safeFetchJson, SafeFetchError } from "@/lib/utils/fetch";
import { TUAS_MONITOR_POINT } from "@/lib/constants/geo";

const BASE = "https://api.data.gov.sg/v1/environment";

function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface NearestReading {
  value: number;
  stationName: string;
  timestamp: string;
  distanceKm: number;
}

/** Fetch one NEA dataset and return the reading from the station nearest Tuas. */
async function nearestReading(
  dataset: string,
  signal?: AbortSignal,
): Promise<NearestReading | null> {
  const json = await safeFetchJson<unknown>(`${BASE}/${dataset}`, {
    timeoutMs: 7000,
    retries: 1,
    signal,
  });
  const parsed = neaEnvironmentReadingSchema.parse(json);
  const item = parsed.items[0];
  const stations = parsed.metadata?.stations ?? [];
  if (!item || stations.length === 0) return null;

  let best: { id: string; name: string; dist: number } | null = null;
  for (const s of stations) {
    const dist = haversineKm(TUAS_MONITOR_POINT, {
      lat: s.location.latitude,
      lon: s.location.longitude,
    });
    if (!best || dist < best.dist) best = { id: s.id, name: s.name, dist };
  }
  if (!best) return null;

  const reading = item.readings.find((r) => r.station_id === best!.id);
  if (!reading) return null;
  return {
    value: reading.value,
    stationName: best.name,
    timestamp: item.timestamp,
    distanceKm: best.dist,
  };
}

/**
 * Fetch and normalise live Singapore weather near Tuas. Throws
 * {@link SafeFetchError} when the core temperature dataset is unavailable;
 * individual optional fields degrade to null.
 */
export async function fetchLiveWeather(
  signal?: AbortSignal,
): Promise<WeatherObservation> {
  const [temp, rainfall, windSpeed, windDir, humidity] =
    await Promise.allSettled([
      nearestReading("air-temperature", signal),
      nearestReading("rainfall", signal),
      nearestReading("wind-speed", signal),
      nearestReading("wind-direction", signal),
      nearestReading("relative-humidity", signal),
    ]);

  const val = (r: PromiseSettledResult<NearestReading | null>) =>
    r.status === "fulfilled" && r.value ? r.value : null;

  const t = val(temp);
  if (!t) {
    throw new SafeFetchError(
      "WEATHER_UNAVAILABLE",
      "Core weather dataset unavailable.",
    );
  }
  const rain = val(rainfall);
  const ws = val(windSpeed);
  const wd = val(windDir);
  const rh = val(humidity);

  // NEA's temperature/wind/humidity networks are sometimes sparse (a single
  // island-wide station), while rainfall has ~77 stations including Tuas. Anchor
  // the displayed location to the CLOSEST station across the metrics we got, so
  // a Tuas-area station is labelled rather than a far one 37 km away. Append the
  // distance when it's not genuinely local (§11: don't pass far readings off as
  // Tuas-specific without location context).
  const headline = [t, rain, ws, rh]
    .filter((r): r is NearestReading => r != null)
    .reduce((a, b) => (b.distanceKm < a.distanceKm ? b : a), t);
  const stationLabel =
    headline.distanceKm > 8
      ? `${headline.stationName} (~${Math.round(headline.distanceKm)} km from Tuas)`
      : headline.stationName;

  return {
    // NEA rainfall is a 5-minute total (mm); convert to an approximate mm/hr.
    rainfallMmPerHr: rain ? Number((rain.value * 12).toFixed(1)) : null,
    windSpeedKnots: ws ? ws.value : null,
    windDirectionDegrees: wd ? wd.value : null,
    temperatureC: t.value,
    relativeHumidityPct: rh ? rh.value : null,
    stationName: stationLabel,
    observedAt: new Date(headline.timestamp).toISOString(),
  };
}
