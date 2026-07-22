/**
 * AIS vessel provider (§11). Two modes via AIS_PROVIDER_MODE:
 *   demo      → deterministic fixture vessels (handled by the demo provider).
 *   aisstream → live vessels from AISStream.
 *
 * For `aisstream`, the app self-manages an in-server websocket (see ais-live.ts)
 * that connects automatically while the server runs and reconnects on drop — so
 * every dashboard refresh ensures a live connection, with no separate collector
 * to start by hand. If a standalone `scripts/ais-collector.ts` process is also
 * running, its snapshot file is used as a fallback. The AIS key is server-only
 * and never exposed to the browser. Positions can be sparse, delayed or spoofed.
 */

import { readFile } from "node:fs/promises";
import type { VesselSnapshot } from "@/types";
import { SafeFetchError } from "@/lib/utils/fetch";
import { ensureAisConnection, getAisSnapshot } from "./ais-live";

/** Path the standalone collector writes to (fallback source). */
export const AIS_SNAPSHOT_FILE = "data/ais-snapshot.json";

export async function fetchLiveVessels(): Promise<VesselSnapshot> {
  // Make sure the in-server AIS websocket is up (auto-reconnects on refresh).
  ensureAisConnection();

  const inServer = getAisSnapshot();
  if (inServer) return inServer;

  // Fallback: a standalone collector process, if one is running.
  try {
    const raw = await readFile(AIS_SNAPSHOT_FILE, "utf8");
    const snapshot = JSON.parse(raw) as VesselSnapshot;
    if (snapshot && Array.isArray(snapshot.vessels) && snapshot.vessels.length) {
      return snapshot;
    }
  } catch {
    // no snapshot file — that's fine, the in-server connection is warming up
  }

  throw new SafeFetchError(
    "AIS_CONNECTING",
    "AIS is connecting — vessels appear within a few seconds. Press Refresh again.",
  );
}
