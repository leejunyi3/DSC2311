import "server-only";

import type { AppMode, DemoScenarioId } from "@/types";
import type { FeedKey } from "@/lib/constants/feeds";
import type { BuildSnapshotOptions } from "./build-snapshot";
import { getEnv } from "@/lib/config/env";
import { SCENARIO_IDS } from "@/fixtures";

/**
 * Turn request search params + validated env into BuildSnapshotOptions.
 * The application defaults to Demo Mode; Live Mode is opt-in via ?mode=live.
 */
export function resolveSnapshotOptions(
  searchParams: URLSearchParams,
): BuildSnapshotOptions {
  const env = getEnv();

  const modeParam = searchParams.get("mode");
  const mode: AppMode = modeParam === "live" ? "live" : "demo";

  const scenarioParam = searchParams.get("scenario");
  const scenarioId: DemoScenarioId =
    scenarioParam && (SCENARIO_IDS as string[]).includes(scenarioParam)
      ? (scenarioParam as DemoScenarioId)
      : env.DEMO_SCENARIO;

  const liveToggles: Record<FeedKey, boolean> = {
    weather: env.ENABLE_LIVE_WEATHER,
    lightning: env.ENABLE_LIVE_LIGHTNING,
    marine: env.ENABLE_LIVE_MARINE,
    vessels: env.AIS_PROVIDER_MODE === "aisstream",
    disruptions: env.ENABLE_LIVE_DISRUPTIONS,
  };

  return {
    mode,
    scenarioId,
    seed: env.DEMO_SEED,
    cacheTtlSeconds: env.CACHE_TTL_SECONDS,
    liveToggles,
  };
}
