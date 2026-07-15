import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { requireAnthropicConfig } from "@/lib/config/env";

/**
 * Server-only Anthropic client factory (§6). The API key never leaves the
 * server. The model is read from ANTHROPIC_MODEL — there is NO hardcoded model
 * default; `requireAnthropicConfig()` throws if it is missing.
 */
export interface AnthropicRuntime {
  client: Anthropic;
  model: string;
  enableWebSearch: boolean;
}

export function createAnthropicRuntime(): AnthropicRuntime {
  const cfg = requireAnthropicConfig();
  return {
    client: new Anthropic({ apiKey: cfg.apiKey }),
    model: cfg.model,
    enableWebSearch: cfg.enableWebSearch,
  };
}

export const CHAT_LIMITS = {
  /** Maximum characters accepted for a single user message (§6). */
  maxUserMessageChars: 4000,
  /** Maximum messages retained from the client history. */
  maxHistoryMessages: 20,
  /** Maximum agentic tool-use iterations (§21). */
  maxToolLoops: 6,
  maxOutputTokens: 1500,
} as const;
