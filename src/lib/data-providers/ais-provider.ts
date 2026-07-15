/**
 * AIS vessel provider (§11). Two modes via AIS_PROVIDER_MODE:
 *   demo      → deterministic fixture vessels (handled by the demo provider).
 *   aisstream → a long-running Node collector (scripts/ais-collector.ts) holds
 *               a websocket to AISStream, applies the geographic filter and
 *               writes a LIMITED current snapshot to disk. This function reads
 *               that snapshot file; it never opens the socket itself, because a
 *               short-lived serverless request cannot maintain one.
 *
 * The collector and the web server are SEPARATE processes, so the hand-off is a
 * file on disk (`data/ais-snapshot.json`), not an in-process cache. The AIS key
 * is used only by the collector and is never exposed to the browser. AIS
 * positions can be sparse, delayed or spoofed.
 */

import { readFile } from "node:fs/promises";
import type { VesselSnapshot } from "@/types";
import { SafeFetchError } from "@/lib/utils/fetch";

/** Path the collector writes to (relative to the server's working directory). */
export const AIS_SNAPSHOT_FILE = "data/ais-snapshot.json";

/**
 * Read the most recent AIS snapshot the collector wrote. Throws when no
 * snapshot exists yet so the feed degrades honestly instead of inventing
 * vessels. Data age is judged downstream by the freshness engine.
 */
export async function fetchLiveVessels(): Promise<VesselSnapshot> {
  let raw: string;
  try {
    raw = await readFile(AIS_SNAPSHOT_FILE, "utf8");
  } catch {
    throw new SafeFetchError(
      "AIS_NO_SNAPSHOT",
      "No AIS snapshot yet. Start the collector with a valid AISSTREAM_API_KEY (npm run ais:collect).",
    );
  }

  let snapshot: VesselSnapshot;
  try {
    snapshot = JSON.parse(raw) as VesselSnapshot;
  } catch {
    throw new SafeFetchError("AIS_BAD_SNAPSHOT", "AIS snapshot is unreadable.");
  }

  if (!snapshot || !Array.isArray(snapshot.vessels)) {
    throw new SafeFetchError("AIS_BAD_SNAPSHOT", "AIS snapshot is malformed.");
  }
  return snapshot;
}
