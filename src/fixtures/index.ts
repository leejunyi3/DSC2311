import type { DemoScenarioId } from "@/types";
import type { ScenarioFixture } from "@/types/fixtures";
import normalOperations from "./normal-operations.json";
import thunderstorm from "./thunderstorm.json";
import regionalDisruption from "./regional-disruption.json";
import pharmaceuticalCrisis from "./pharmaceutical-crisis.json";

export const SCENARIOS: Record<DemoScenarioId, ScenarioFixture> = {
  "normal-operations": normalOperations as ScenarioFixture,
  thunderstorm: thunderstorm as ScenarioFixture,
  "regional-disruption": regionalDisruption as ScenarioFixture,
  "pharmaceutical-crisis": pharmaceuticalCrisis as ScenarioFixture,
};

export const SCENARIO_IDS = Object.keys(SCENARIOS) as DemoScenarioId[];

export function getScenario(id: DemoScenarioId): ScenarioFixture {
  return SCENARIOS[id];
}
