import "server-only";

import { requireGeminiConfig } from "@/lib/config/env";

/**
 * Server-only Google Gemini client (Google AI Studio, free tier). The API key
 * is sent as the `x-goog-api-key` header — never in the URL/query — so it can't
 * leak into logs. The model is read from `GEMINI_MODEL`.
 *
 * We call the documented REST `generateContent` endpoint directly (no SDK
 * dependency) and drive function-calling ourselves. Tool execution and the
 * deterministic snapshot are provider-agnostic — only message formatting
 * differs from the Anthropic path.
 *
 * Docs: https://ai.google.dev/gemini-api/docs/function-calling
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiRequest {
  system_instruction?: { parts: { text: string }[] };
  contents: GeminiContent[];
  tools?: Array<{ functionDeclarations: unknown[] }>;
  toolConfig?: { functionCallingConfig: { mode: string } };
  generationConfig?: { maxOutputTokens?: number; temperature?: number };
}

export interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

export const GEMINI_LIMITS = {
  maxUserMessageChars: 4000,
  maxHistoryMessages: 20,
  maxToolLoops: 6,
  maxOutputTokens: 1500,
} as const;

/**
 * Call Gemini `generateContent`. Retries transient 429/5xx responses with
 * exponential backoff. Never surfaces the raw provider error (which could echo
 * request internals) — throws a sanitised message instead.
 */
export async function callGemini(body: GeminiRequest): Promise<GeminiResponse> {
  const cfg = requireGeminiConfig();
  const url = `${BASE}/${encodeURIComponent(cfg.model)}:generateContent`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cfg.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(
          res.status === 429
            ? "Gemini free-tier rate limit reached. Please wait a moment and retry."
            : `Gemini service error (${res.status}).`,
        );
      } else if (!res.ok) {
        // Non-retryable (e.g. 400 bad model / 403 invalid key).
        throw new Error(
          res.status === 403
            ? "Gemini rejected the API key (403). Check GEMINI_API_KEY."
            : `Gemini request failed (${res.status}).`,
        );
      } else {
        return (await res.json()) as GeminiResponse;
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Gemini request failed"))
        throw err;
      if (err instanceof Error && err.message.startsWith("Gemini rejected"))
        throw err;
      lastError =
        err instanceof DOMException && err.name === "AbortError"
          ? new Error("Gemini request timed out.")
          : new Error("Gemini network error.");
    } finally {
      clearTimeout(timer);
    }

    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 600 * 2 ** attempt));
    }
  }
  throw lastError ?? new Error("Gemini request failed.");
}
