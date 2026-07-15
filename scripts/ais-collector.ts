/**
 * Long-running AIS collector (§11). A persistent production AIS connection needs
 * a long-running Node process, NOT a short-lived serverless function — this
 * script is that process.
 *
 * It opens a websocket to AISStream, applies a geographic filter to the Tuas
 * bounding box, keeps only a LIMITED current snapshot (latest position per MMSI)
 * and writes it to disk for the app to read. The AIS key is used only here,
 * server-side, and is never exposed to the browser.
 *
 * Run:  AISSTREAM_API_KEY=... AIS_PROVIDER_MODE=aisstream npm run ais:collect
 *
 * Requires Node 22+ for the global WebSocket, or install `ws` and swap the
 * import. This script is intentionally standalone and is not bundled with the
 * Next.js app.
 */

import { writeFile, mkdir, rename } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";

// This is a standalone script (tsx), so it does NOT get Next.js's automatic
// .env.local loading. Load it here so `npm run ais:collect` just works.
function loadEnvLocal(): void {
  try {
    const txt = readFileSync(".env.local", "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1]!;
      let val = m[2]!.trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // no .env.local — rely on the ambient environment
  }
}
loadEnvLocal();

const API_KEY = (process.env.AISSTREAM_API_KEY ?? "").trim();
const OUT = "data/ais-snapshot.json";
// Slightly wider than the app geofence so Tuas + the busy western Singapore
// Strait approaches are captured (livelier live traffic).
const BBOX = [
  [1.15, 103.55],
  [1.35, 103.9],
]; // [[latMin, lonMin], [latMax, lonMax]]

interface Snap {
  mmsi: string;
  name: string;
  lat: number;
  lon: number;
  speedKnots: number;
  courseDegrees: number | null;
  headingDegrees: number | null;
  vesselType: string;
  lastReceivedAt: string;
}

const latest = new Map<string, Snap>();

// Exponential reconnect backoff. AISStream's free tier throttles rapid
// reconnects (closing with code 1006 before the socket even opens), so we back
// off 5s → 10s → 20s → 40s → 60s and reset once real data flows again.
let backoffMs = 5000;
const MAX_BACKOFF_MS = 60_000;

function classify(speed: number): "normal" | "slow" | "stationary" {
  if (speed < 0.5) return "stationary";
  if (speed < 3) return "slow";
  return "normal";
}

async function persist(): Promise<void> {
  const vessels = Array.from(latest.values()).map((v) => ({
    ...v,
    motion: classify(v.speedKnots),
  }));
  const slow = vessels.filter((v) => v.motion === "slow").length;
  const stationary = vessels.filter((v) => v.motion === "stationary").length;
  const avg =
    vessels.length === 0
      ? 0
      : vessels.reduce((s, v) => s + v.speedKnots, 0) / vessels.length;

  const snapshot = {
    vessels,
    vesselCount: vessels.length,
    slowMovingCount: slow,
    stationaryCount: stationary,
    averageSpeedKnots: Number(avg.toFixed(1)),
    observedAt: new Date().toISOString(),
  };
  // Atomic write (tmp + rename) so the web server never reads a partial file.
  await mkdir(dirname(OUT), { recursive: true });
  const tmp = `${OUT}.tmp`;
  await writeFile(tmp, JSON.stringify(snapshot, null, 2));
  await rename(tmp, OUT);
}

function connect(): void {
  const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
  // AISStream sends binary frames; Node's WebSocket delivers them as ArrayBuffer
  // (or Blob) — decode to text before JSON.parse.
  ws.binaryType = "arraybuffer";

  ws.addEventListener("open", () => {
    ws.send(
      JSON.stringify({
        APIKey: API_KEY,
        BoundingBoxes: [BBOX],
        FilterMessageTypes: ["PositionReport"],
      }),
    );
    console.log("AIS collector connected; filtering Tuas bounding box.");
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
      if (!meta || !pr) return;
      const mmsi = String(meta.MMSI);
      backoffMs = 5000; // data is flowing — reset the reconnect backoff
      latest.set(mmsi, {
        mmsi,
        name: (meta.ShipName ?? "").trim() || `MMSI ${mmsi}`,
        lat: meta.latitude,
        lon: meta.longitude,
        speedKnots: pr.Sog ?? 0,
        courseDegrees: pr.Cog ?? null,
        headingDegrees: pr.TrueHeading ?? null,
        vesselType: "Unknown",
        lastReceivedAt: meta.time_utc ?? new Date().toISOString(),
      });
    } catch {
      // Ignore malformed frames rather than crash the collector.
    }
  });

  ws.addEventListener("close", () => {
    const wait = backoffMs;
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    console.warn(`AIS socket closed; reconnecting in ${wait / 1000}s.`);
    setTimeout(connect, wait);
  });
  ws.addEventListener("error", () => {
    // The close handler performs the reconnect.
  });
}

function main(): void {
  if (!API_KEY) {
    console.error("AISSTREAM_API_KEY is required. Exiting.");
    process.exit(1);
  }
  if (typeof WebSocket === "undefined") {
    console.error("Global WebSocket unavailable. Use Node 22+ or install `ws`.");
    process.exit(1);
  }
  connect();
  // Persist a limited snapshot every 15 seconds (set up once).
  setInterval(() => {
    void persist();
  }, 15_000);
}

main();
