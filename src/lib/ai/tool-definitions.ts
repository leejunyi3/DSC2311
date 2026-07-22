/**
 * Claude tool definitions (§21). Each tool has a precise description and a
 * strict JSON input schema. The tool runner additionally re-validates every
 * input with the matching Zod schema before executing anything.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: boolean;
  };
}

const NO_INPUT = {
  type: "object" as const,
  properties: {},
  additionalProperties: false,
};

const SIM_PROPERTIES: Record<string, unknown> = {
  cargoType: {
    type: "string",
    enum: ["general", "perishables", "pharmaceuticals", "industrial", "medical"],
  },
  criticality: { type: "string", enum: ["low", "standard", "high", "critical"] },
  coldChain: { type: "boolean" },
  safetyStockDays: { type: "number", minimum: 0, maximum: 365 },
  dailyDemand: { type: "number", minimum: 0 },
  expectedDelayHours: { type: "number", minimum: 0, maximum: 2160 },
  unitShortageCost: { type: "number", minimum: 0 },
  alternativeKind: {
    type: "string",
    enum: [
      "wait",
      "tanjung-pelepas",
      "port-klang",
      "johor-pasir-gudang",
      "batam",
      "penang",
      "jurong-port",
      "airfreight-changi",
      "custom",
    ],
  },
  alternativeTransitHours: { type: "number", minimum: 0, maximum: 2160 },
  additionalHandlingHours: { type: "number", minimum: 0, maximum: 2160 },
  additionalReroutingCost: { type: "number", minimum: 0 },
  customerPriority: {
    type: "string",
    enum: ["standard", "priority", "key-account"],
  },
  emergencyReplenishmentQty: { type: "number", minimum: 0 },
  emergencyReplenishmentLeadHours: { type: "number", minimum: 0, maximum: 2160 },
  emergencyReplenishmentCost: { type: "number", minimum: 0 },
};

const SIM_REQUIRED = Object.keys(SIM_PROPERTIES);

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_dashboard_snapshot",
    description:
      "Return the full current server-computed dashboard snapshot: mode, scenario, overall risk, component scores, estimated congestion, confidence, feed health and active alerts. Use this to ground any operational answer.",
    input_schema: NO_INPUT,
  },
  {
    name: "get_singapore_weather",
    description:
      "Return the current Singapore weather observation nearest Tuas (rainfall, wind, temperature, humidity) with its source, timestamp, data status and confidence.",
    input_schema: NO_INPUT,
  },
  {
    name: "get_lightning_risk",
    description:
      "Return recent lightning activity near the monitoring point (recent count, nearest distance, age). Note the source does not detect every lightning event.",
    input_schema: NO_INPUT,
  },
  {
    name: "get_marine_forecast",
    description:
      "Return the marine FORECAST (wave height, period, direction, swell) for a location. Forecast only; not for navigation.",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          enum: ["tuas", "singapore-strait", "malacca-strait"],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_tuas_vessel_snapshot",
    description:
      "Return the current AIS vessel snapshot within the monitoring geofence (counts, average speed, per-vessel motion). AIS may be sparse, delayed or spoofed.",
    input_schema: NO_INPUT,
  },
  {
    name: "get_estimated_congestion",
    description:
      "Return the Estimated Tuas Congestion score and status. This is an AIS-based analytical estimate, NOT official PSA berth, queue or waiting-time data.",
    input_schema: NO_INPUT,
  },
  {
    name: "get_recent_maritime_disruptions",
    description:
      "Return recent maritime disruptions relevant to Tuas with severity, location, source, timestamps, confidence and data status.",
    input_schema: {
      type: "object",
      properties: { maxItems: { type: "number", minimum: 1, maximum: 25 } },
      additionalProperties: false,
    },
  },
  {
    name: "calculate_resilience_risk",
    description:
      "Return the deterministic overall resilience risk, its category, weighted component breakdown and top drivers. Numbers are computed in code — do not alter them.",
    input_schema: NO_INPUT,
  },
  {
    name: "run_supply_chain_simulation",
    description:
      "Run the deterministic supply-chain inventory simulation for a scenario and return coverage, coverage gap, shortage units, exposure and costs. Provide all fields.",
    input_schema: {
      type: "object",
      properties: SIM_PROPERTIES,
      required: SIM_REQUIRED,
      additionalProperties: false,
    },
  },
  {
    name: "compare_response_options",
    description:
      "Compare wait vs reroute vs emergency-replenishment options deterministically and return the recommended option, its reason, assumptions and whether human approval is required.",
    input_schema: {
      type: "object",
      properties: SIM_PROPERTIES,
      required: SIM_REQUIRED,
      additionalProperties: false,
    },
  },
  {
    name: "search_institutional_knowledge",
    description:
      "Search the project's institutional knowledge (operating principles, cargo-priority policy, source hierarchy, risk methodology, data limitations, human-approval policy).",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1, maxLength: 400 } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_data_source_health",
    description:
      "Return the health of every monitored feed: status, connection, data age, expected freshness and last safe error message.",
    input_schema: NO_INPUT,
  },
];
