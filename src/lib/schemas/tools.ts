import { z } from "zod";
import { simulationInputSchema } from "./simulator";

/**
 * Zod schemas for every Claude tool INPUT (§21). The tool runner parses each
 * `tool_use` block through the matching schema before executing anything, so a
 * malformed or injected argument set is rejected deterministically instead of
 * reaching provider or engine code.
 *
 * Most read-only snapshot tools take no arguments; we still declare an explicit
 * (empty, non-strict) object so the JSON schema we hand to Claude is precise.
 */
const emptyInput = z.object({}).strip();

export const toolInputSchemas = {
  get_dashboard_snapshot: emptyInput,
  get_singapore_weather: emptyInput,
  get_lightning_risk: emptyInput,
  get_marine_forecast: z
    .object({
      location: z
        .enum(["tuas", "singapore-strait", "malacca-strait"])
        .optional(),
    })
    .strip(),
  get_tuas_vessel_snapshot: emptyInput,
  get_estimated_congestion: emptyInput,
  get_recent_maritime_disruptions: z
    .object({
      maxItems: z.number().int().min(1).max(25).optional(),
    })
    .strip(),
  calculate_resilience_risk: emptyInput,
  run_supply_chain_simulation: simulationInputSchema,
  compare_response_options: simulationInputSchema,
  suggest_best_route: simulationInputSchema,
  search_institutional_knowledge: z
    .object({
      query: z.string().min(1).max(400),
    })
    .strip(),
  get_data_source_health: emptyInput,
} as const;

export type ToolName = keyof typeof toolInputSchemas;

export const TOOL_NAMES = Object.keys(toolInputSchemas) as ToolName[];

export function isToolName(name: string): name is ToolName {
  return Object.prototype.hasOwnProperty.call(toolInputSchemas, name);
}
