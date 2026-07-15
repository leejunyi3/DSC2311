/**
 * Lightning observation provider (§11).
 *
 * LIVE path uses the keyless, documented NEA Lightning Observation dataset via
 * data.gov.sg's v2 real-time weather API. It returns recent cloud-to-cloud /
 * cloud-to-ground strikes with a string lat/lon; we compute the recent count
 * and the nearest-strike distance to the Tuas monitoring point.
 *
 * Docs / dataset:
 *   https://data.gov.sg/datasets/d_08238953fe0f6dd13f10714ebfbcb9f9/view
 *   GET https://api-open.data.gov.sg/v2/real-time/api/weather?api=lightning
 *
 * The detection system does not catch every event (≈90–95% efficiency when all
 * sensors are up); confidence reflects that. When there is no lightning the API
 * returns an empty readings array — that's a valid "0 strikes" reading, not an
 * error.
 */

import type { LightningObservation } from "@/types";
import { neaLightningSchema } from "@/lib/schemas/providers";
import { safeFetchJson, SafeFetchError } from "@/lib/utils/fetch";
import { TUAS_MONITOR_POINT } from "@/lib/constants/geo";

const LIGHTNING_URL =
  "https://api-open.data.gov.sg/v2/real-time/api/weather?api=lightning";

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

export async function fetchLiveLightning(
  signal?: AbortSignal,
): Promise<LightningObservation> {
  const json = await safeFetchJson<unknown>(LIGHTNING_URL, {
    timeoutMs: 7000,
    retries: 1,
    signal,
  });
  const parsed = neaLightningSchema.parse(json);

  const record = parsed.data.records[0];
  if (!record) {
    throw new SafeFetchError(
      "LIGHTNING_UNAVAILABLE",
      "No lightning observation returned.",
    );
  }

  const readings = record.item.readings;
  let nearestKm: number | null = null;
  for (const r of readings) {
    const lat = Number(r.location.latitude);
    const lon = Number(r.location.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const d = haversineKm(TUAS_MONITOR_POINT, { lat, lon });
    if (nearestKm === null || d < nearestKm) nearestKm = Number(d.toFixed(1));
  }

  const observedIso = record.updatedTimestamp ?? record.datetime;
  const observedAt = observedIso
    ? new Date(observedIso).toISOString()
    : new Date().toISOString();

  return {
    recentCount: readings.length,
    nearestKm,
    observedAt,
  };
}
