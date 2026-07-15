/**
 * Server-only environment configuration with Zod validation (§6, §33.1).
 *
 * Design rules honoured here:
 *  - Demo Mode must start with ZERO API keys present, so nothing throws at
 *    import time for missing keys.
 *  - `ANTHROPIC_MODEL` has NO hardcoded default. If the assistant is invoked
 *    without it, `requireAnthropicConfig()` throws a clear configuration error.
 *  - Booleans come from string env vars via an explicit coercion.
 */

import { z } from "zod";
import "server-only";

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ANTHROPIC_MODEL: z.string().optional().default(""),
  ENABLE_ANTHROPIC_WEB_SEARCH: boolFromString,

  AIS_PROVIDER_MODE: z.enum(["demo", "aisstream"]).optional().default("demo"),
  AISSTREAM_API_KEY: z
    .string()
    .optional()
    .default("")
    .transform((v) => v.trim()),

  ENABLE_LIVE_WEATHER: boolFromString,
  ENABLE_LIVE_LIGHTNING: boolFromString,
  ENABLE_LIVE_MARINE: boolFromString,
  ENABLE_LIVE_DISRUPTIONS: boolFromString,

  CACHE_TTL_SECONDS: z.coerce.number().int().positive().optional().default(300),
  DEMO_SCENARIO: z
    .enum([
      "normal-operations",
      "thunderstorm",
      "regional-disruption",
      "pharmaceutical-crisis",
    ])
    .optional()
    .default("pharmaceutical-crisis"),
  DEMO_SEED: z.coerce.number().int().optional().default(2301),

  REDIS_URL: z.string().optional().default(""),
  DATABASE_URL: z.string().optional().default(""),

  // ── AI assistant provider ──
  // Which state-of-the-art LLM API powers the assistant.
  //   gemini    — Google AI Studio free tier (no card required)
  //   anthropic — Claude via the Anthropic SDK
  AI_PROVIDER: z.enum(["gemini", "anthropic"]).optional().default("gemini"),
  GEMINI_API_KEY: z
    .string()
    .optional()
    .default("")
    .transform((v) => v.trim()),
  GEMINI_MODEL: z
    .string()
    .optional()
    .default("gemini-flash-lite-latest")
    .transform((v) => v.trim()),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Never echo raw values; only report which keys are malformed.
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration for: ${keys}`);
  }
  cached = parsed.data;
  return cached;
}

export function hasAnthropicKey(): boolean {
  return getEnv().ANTHROPIC_API_KEY.length > 0;
}

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  enableWebSearch: boolean;
}

/**
 * Resolve the Anthropic configuration or throw a clear, secret-free error.
 * Called only when the assistant actually needs to reach the API.
 */
export function requireAnthropicConfig(): AnthropicConfig {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. The AI assistant is disabled; Demo Mode dashboards still work.",
    );
  }
  if (!env.ANTHROPIC_MODEL) {
    throw new Error(
      "ANTHROPIC_MODEL is not set. No model default is hardcoded — set ANTHROPIC_MODEL to enable the assistant.",
    );
  }
  return {
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL,
    enableWebSearch: env.ENABLE_ANTHROPIC_WEB_SEARCH,
  };
}

// ── Provider-agnostic assistant resolution ─────────────────────────────

export type AssistantProvider = "gemini" | "anthropic";

export interface ActiveAssistant {
  provider: AssistantProvider;
  /** True when the active provider has an API key configured. */
  enabled: boolean;
  model: string;
}

/**
 * Which LLM provider the assistant should use, and whether it's usable.
 * Demo dashboards work regardless; only the live conversation needs a key.
 */
export function getActiveAssistant(): ActiveAssistant {
  const env = getEnv();
  if (env.AI_PROVIDER === "anthropic") {
    return {
      provider: "anthropic",
      enabled: env.ANTHROPIC_API_KEY.length > 0,
      model: env.ANTHROPIC_MODEL,
    };
  }
  return {
    provider: "gemini",
    enabled: env.GEMINI_API_KEY.length > 0,
    model: env.GEMINI_MODEL,
  };
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

/** Resolve the Gemini configuration or throw a clear, secret-free error. */
export function requireGeminiConfig(): GeminiConfig {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey. Demo dashboards still work without it.",
    );
  }
  return { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL };
}
