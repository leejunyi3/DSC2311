import "server-only";

/**
 * In-server AIS manager. Keeps ONE AISStream websocket open inside the running
 * web server (as a globalThis singleton so it survives hot-reloads), accumulates
 * a limited current snapshot in memory, and reconnects automatically on drop.
 *
 * This means Live Mode "just works" while the server runs — no separate
 * long-running collector process to start manually. Every dashboard refresh
 * calls `ensureAisConnection()`, so a dropped connection is re-established on the
 * next refresh. The standalone `scripts/ais-collector.ts` remains as the
 * production-grade option (a dedicated process), but the app self-manages here.
 *
 * The AIS key is read server-side only and never reaches the browser.
 */

import type { Vessel, VesselSnapshot, VesselMotion } from "@/types";
import { AIS_BOUNDING_BOX } from "@/lib/constants/geo";
import { CONGESTION_CONFIG } from "@/lib/risk/risk-config";
import { getEnv } from "@/lib/config/env";

interface LiveVessel {
  mmsi: string;
  name: string;
  lat: number;
  lon: number;
  speedKnots: number;
  courseDegrees: number | null;
  headingDegrees: number | null;
  vesselType: string;
  lastReceivedAt: number; // epoch ms
}

interface AisState {
  ws: WebSocket | null;
  vessels: Map<string, LiveVessel>;
  connecting: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  failures: number;
}

// Persist across HMR / module reloads by hanging state off globalThis.
const g = globalThis as unknown as { __tuasAis?: AisState };
function state(): AisState {
  if (!g.__tuasAis) {
    g.__tuasAis = {
      ws: null,
      vessels: new Map(),
      connecting: false,
      reconnectTimer: null,
      failures: 0,
    };
  }
  return g.__tuasAis;
}

const MAX_VESSEL_AGE_MS = 10 * 60 * 1000; // drop vessels not heard from in 10 min

function classify(speed: number): VesselMotion {
  if (speed < CONGESTION_CONFIG.stationarySpeedKnots) return "stationary";
  if (speed < CONGESTION_CONFIG.slowSpeedKnots) return "slow";
  return "normal";
}

/** Idempotent: opens the websocket if it isn't already open/connecting. */
export function ensureAisConnection(): void {
  const env = getEnv();
  if (env.AIS_PROVIDER_MODE !== "aisstream" || !env.AISSTREAM_API_KEY) return;
  if (typeof WebSocket === "undefined") return;

  const s = state();
  // Exactly one connection at a time (AISStream free tier allows one per key).
  if (s.connecting) return;
  if (s.reconnectTimer) return; // a reconnect is already scheduled
  if (
    s.ws &&
    (s.ws.readyState === WebSocket.OPEN ||
      s.ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }
  connect(env.AISSTREAM_API_KEY);
}

function connect(apiKey: string): void {
  const s = state();
  if (s.reconnectTimer) {
    clearTimeout(s.reconnectTimer);
    s.reconnectTimer = null;
  }
  s.connecting = true;

  let ws: WebSocket;
  try {
    ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
  } catch {
    s.connecting = false;
    return;
  }
  ws.binaryType = "arraybuffer";
  s.ws = ws;

  ws.addEventListener("open", () => {
    s.connecting = false;
    s.failures = 0; // healthy connection — reset backoff
    ws.send(
      JSON.stringify({
        APIKey: apiKey,
        BoundingBoxes: [AIS_BOUNDING_BOX],
        FilterMessageTypes: ["PositionReport"],
      }),
    );
  });

  ws.addEventListener("message", (event: MessageEvent) => {
    try {
      const raw =
        typeof event.data === "string"
          ? event.data
          : new TextDecoder().decode(event.data as ArrayBuffer);
      const msg = JSON.parse(raw);
      const meta = msg?.MetaData;
      const pr = msg?.Message?.PositionReport;
      if (!meta || pr == null) return;
      const mmsi = String(meta.MMSI);
      s.vessels.set(mmsi, {
        mmsi,
        name: (meta.ShipName ?? "").trim() || `MMSI ${mmsi}`,
        lat: meta.latitude,
        lon: meta.longitude,
        speedKnots: pr.Sog ?? 0,
        courseDegrees: pr.Cog ?? null,
        headingDegrees: pr.TrueHeading ?? null,
        vesselType: "Unknown",
        lastReceivedAt: Date.now(),
      });
    } catch {
      // ignore malformed frames
    }
  });

  ws.addEventListener("close", () => {
    s.connecting = false;
    s.ws = null;
    s.failures = Math.min(s.failures + 1, 5);
    // Exponential backoff (6s → up to ~90s) so repeated failures don't hammer
    // AISStream (which would prolong its rate-limit). Only ONE pending reconnect
    // at a time, so we never stack competing connections.
    if (!s.reconnectTimer) {
      const delay = Math.min(90_000, 6000 * 2 ** (s.failures - 1));
      s.reconnectTimer = setTimeout(() => {
        s.reconnectTimer = null;
        ensureAisConnection();
      }, delay);
    }
  });

  ws.addEventListener("error", () => {
    // The close handler performs the reconnect.
  });
}

/** Build a current snapshot from in-memory positions, or null if none yet. */
export function getAisSnapshot(): VesselSnapshot | null {
  const s = state();
  const now = Date.now();
  const vessels: Vessel[] = [];

  for (const v of s.vessels.values()) {
    if (now - v.lastReceivedAt > MAX_VESSEL_AGE_MS) {
      s.vessels.delete(v.mmsi);
      continue;
    }
    const motion = classify(v.speedKnots);
    vessels.push({
      mmsi: v.mmsi,
      name: v.name,
      lat: Number(v.lat.toFixed(5)),
      lon: Number(v.lon.toFixed(5)),
      speedKnots: Number(v.speedKnots.toFixed(1)),
      courseDegrees: v.courseDegrees,
      headingDegrees: v.headingDegrees,
      vesselType: v.vesselType,
      lastReceivedAt: new Date(v.lastReceivedAt).toISOString(),
      motion,
    });
  }

  if (vessels.length === 0) return null;

  const slow = vessels.filter((v) => v.motion === "slow").length;
  const stationary = vessels.filter((v) => v.motion === "stationary").length;
  const avg = vessels.reduce((a, v) => a + v.speedKnots, 0) / vessels.length;

  return {
    vessels,
    vesselCount: vessels.length,
    slowMovingCount: slow,
    stationaryCount: stationary,
    averageSpeedKnots: Number(avg.toFixed(1)),
    observedAt: new Date().toISOString(),
  };
}
