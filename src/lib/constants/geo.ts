/**
 * Geographic constants for the Tuas monitoring area. These define an
 * APPROXIMATE project monitoring geofence — NOT an official port boundary.
 */

export const TUAS_MONITOR_POINT = {
  lat: 1.2494,
  lon: 103.6363,
  label: "Tuas Port approach (project monitoring point)",
} as const;

/**
 * Approximate rectangular-ish geofence around Tuas / western Singapore waters,
 * as a closed polygon of [lat, lon] pairs. Used for the map overlay and to
 * describe the AIS geographic filter. Not an official boundary.
 */
export const MONITORING_GEOFENCE: ReadonlyArray<readonly [number, number]> = [
  [1.32, 103.58],
  [1.32, 103.72],
  [1.18, 103.72],
  [1.18, 103.58],
  [1.32, 103.58],
];

/** AISStream bounding box [[latMin, lonMin], [latMax, lonMax]] style. */
export const AIS_BOUNDING_BOX: [[number, number], [number, number]] = [
  [1.18, 103.58],
  [1.32, 103.72],
];

/**
 * Typical vessel count across the western/central Singapore approaches that the
 * free AIS feed actually returns. Used as the congestion baseline in LIVE mode
 * (the free feed covers the broader approaches, not just the Tuas berths), so
 * the estimate reflects deviation from normal regional traffic rather than
 * pinning to "Severe". Demo mode uses each scenario's own Tuas baseline.
 */
export const LIVE_VESSEL_BASELINE = 70;

export const MARINE_LOCATIONS = {
  tuas: { lat: 1.24, lon: 103.62, label: "Tuas waters" },
  "singapore-strait": { lat: 1.2, lon: 103.75, label: "Singapore Strait" },
  "malacca-strait": {
    lat: 1.43,
    lon: 102.9,
    label: "Malacca Strait (representative)",
  },
} as const;

export type MarineLocationKey = keyof typeof MARINE_LOCATIONS;

/**
 * Approximate coordinates of the alternative reroute destinations used by the
 * simulator, for drawing the reroute path on the vessel map. These are
 * geographic locations, not live availability — the simulator's transit/cost
 * remain user assumptions.
 */
export const ALTERNATIVE_PORTS: Record<
  string,
  { lat: number; lon: number; label: string }
> = {
  "tanjung-pelepas": {
    lat: 1.363,
    lon: 103.548,
    label: "Port of Tanjung Pelepas",
  },
  "port-klang": { lat: 2.9997, lon: 101.3928, label: "Port Klang" },
  "johor-pasir-gudang": { lat: 1.442, lon: 103.902, label: "Johor Port (Pasir Gudang)" },
  batam: { lat: 1.157, lon: 104.001, label: "Batam (Batu Ampar)" },
  penang: { lat: 5.412, lon: 100.363, label: "Penang Port" },
  "jurong-port": { lat: 1.303, lon: 103.708, label: "Jurong Port" },
  "airfreight-changi": { lat: 1.3644, lon: 103.9915, label: "Changi (airfreight)" },
};

// ── Required disclaimers (§3) ──────────────────────────────────────────
export const CONGESTION_DISCLAIMER =
  "AIS-based analytical estimate using vessel density, vessel speed and dwell indicators. This is not official PSA berth occupancy, queue or waiting-time data.";

export const GEOFENCE_DISCLAIMER =
  "Approximate project monitoring geofence. Not an official port boundary.";

export const STATIONARY_VESSEL_NOTE =
  "Apparently stationary within the monitoring zone. Operational reason unknown.";

export const MARINE_NAV_DISCLAIMER =
  "Forecast data. This application must not be used for vessel navigation.";

export const PROJECT_DISCLAIMER =
  "This student prototype supports supply-chain decision-making but does not provide official port instructions, navigation advice or safety-certified operational information.";
