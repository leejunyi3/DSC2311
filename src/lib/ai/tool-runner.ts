/**
 * Tool runner (§21). Validates each tool input with Zod, executes it against the
 * server-computed snapshot / deterministic engines, and records a SAFE audit
 * trail (tool name, time, success, sources, duration). It never stores keys,
 * auth headers or raw provider responses.
 */

import type { DashboardSnapshot } from "@/types/snapshot";
import { toolInputSchemas, isToolName, type ToolName } from "@/lib/schemas/tools";
import {
  compareResponseOptions,
  suggestBestRoute,
} from "@/lib/simulator/option-comparison";
import { searchKnowledge } from "./knowledge-base";

export interface ToolAuditEntry {
  tool: string;
  invokedAt: string;
  success: boolean;
  durationMs: number;
  dataSources: string[];
  errorCode?: string;
}

export interface ToolExecutionResult {
  ok: boolean;
  content: unknown;
  audit: ToolAuditEntry;
}

function meta(snapshot: DashboardSnapshot, sources: string[]) {
  return {
    mode: snapshot.mode,
    scenario: snapshot.scenarioName,
    generatedAt: snapshot.generatedAt,
    dataSources: sources,
  };
}

export function executeTool(
  rawName: string,
  rawInput: unknown,
  snapshot: DashboardSnapshot,
): ToolExecutionResult {
  const invokedAt = new Date().toISOString();
  const started = Date.now();

  if (!isToolName(rawName)) {
    return {
      ok: false,
      content: { error: `Unknown tool: ${rawName}` },
      audit: {
        tool: rawName,
        invokedAt,
        success: false,
        durationMs: Date.now() - started,
        dataSources: [],
        errorCode: "UNKNOWN_TOOL",
      },
    };
  }

  const name = rawName as ToolName;
  const parsed = toolInputSchemas[name].safeParse(rawInput ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      content: {
        error: "Invalid tool input.",
        issues: parsed.error.issues.map((i) => i.message),
      },
      audit: {
        tool: name,
        invokedAt,
        success: false,
        durationMs: Date.now() - started,
        dataSources: [],
        errorCode: "INVALID_INPUT",
      },
    };
  }

  const input = parsed.data as Record<string, unknown>;
  let content: unknown;
  let sources: string[] = [];

  switch (name) {
    case "get_dashboard_snapshot": {
      sources = snapshot.feeds.map((f) => f.sourceName);
      content = {
        mode: snapshot.mode,
        scenario: snapshot.scenarioName,
        connectivity: snapshot.connectivity,
        risk: snapshot.risk,
        congestion: snapshot.congestion.data,
        confidence: snapshot.confidence,
        alerts: snapshot.disruptions.data,
        feeds: snapshot.feeds,
        limitations: snapshot.limitations,
        generatedAt: snapshot.generatedAt,
      };
      break;
    }
    case "get_singapore_weather": {
      sources = [snapshot.weather.sourceName];
      content = { ...snapshot.weather, meta: meta(snapshot, sources) };
      break;
    }
    case "get_lightning_risk": {
      sources = [snapshot.lightning.sourceName];
      content = { ...snapshot.lightning, meta: meta(snapshot, sources) };
      break;
    }
    case "get_marine_forecast": {
      sources = [snapshot.marine.sourceName];
      content = {
        requestedLocation: input.location ?? "tuas",
        ...snapshot.marine,
        meta: meta(snapshot, sources),
      };
      break;
    }
    case "get_tuas_vessel_snapshot": {
      sources = [snapshot.vessels.sourceName];
      content = {
        status: snapshot.vessels.status,
        observedAt: snapshot.vessels.observedAt,
        confidence: snapshot.vessels.confidence,
        limitations: snapshot.vessels.limitations,
        vesselCount: snapshot.vessels.data?.vesselCount ?? null,
        slowMovingCount: snapshot.vessels.data?.slowMovingCount ?? null,
        stationaryCount: snapshot.vessels.data?.stationaryCount ?? null,
        averageSpeedKnots: snapshot.vessels.data?.averageSpeedKnots ?? null,
        meta: meta(snapshot, sources),
      };
      break;
    }
    case "get_estimated_congestion": {
      sources = [snapshot.congestion.sourceName];
      content = {
        ...snapshot.congestion,
        meta: meta(snapshot, sources),
      };
      break;
    }
    case "get_recent_maritime_disruptions": {
      const maxItems = (input.maxItems as number | undefined) ?? 25;
      sources = [snapshot.disruptions.sourceName];
      content = {
        status: snapshot.disruptions.status,
        items: (snapshot.disruptions.data ?? []).slice(0, maxItems),
        meta: meta(snapshot, sources),
      };
      break;
    }
    case "calculate_resilience_risk": {
      sources = snapshot.feeds.map((f) => f.sourceName);
      content = {
        risk: snapshot.risk,
        confidence: snapshot.confidence,
        note: "Computed deterministically in TypeScript. Do not recompute.",
        meta: meta(snapshot, sources),
      };
      break;
    }
    case "run_supply_chain_simulation":
    case "compare_response_options": {
      sources = ["Deterministic simulator (inventory-engine, option-comparison)"];
      // input already validated against the full simulationInputSchema.
      content = compareResponseOptions(
        input as unknown as Parameters<typeof compareResponseOptions>[0],
      );
      break;
    }
    case "suggest_best_route": {
      sources = ["Deterministic simulator (best-route search across candidate ports)"];
      content = suggestBestRoute(
        input as unknown as Parameters<typeof suggestBestRoute>[0],
      );
      break;
    }
    case "search_institutional_knowledge": {
      sources = ["Institutional knowledge base"];
      const results = searchKnowledge(String(input.query), 3);
      content = {
        query: input.query,
        results: results.map((r) => ({
          id: r.entry.id,
          title: r.entry.title,
          content: r.entry.content,
        })),
      };
      break;
    }
    case "get_data_source_health": {
      sources = snapshot.feeds.map((f) => f.sourceName);
      content = {
        connectivity: snapshot.connectivity,
        confidence: snapshot.confidence,
        feeds: snapshot.feeds,
        meta: meta(snapshot, sources),
      };
      break;
    }
    default: {
      // Exhaustiveness guard.
      const _never: never = name;
      content = { error: `Unhandled tool: ${String(_never)}` };
    }
  }

  return {
    ok: true,
    content,
    audit: {
      tool: name,
      invokedAt,
      success: true,
      durationMs: Date.now() - started,
      dataSources: sources,
    },
  };
}
