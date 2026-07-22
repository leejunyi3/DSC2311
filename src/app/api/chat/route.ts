import type { NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { chatRequestSchema } from "@/lib/schemas/chat";
import { resolveSnapshotOptions } from "@/lib/snapshot/context";
import { buildSnapshot } from "@/lib/snapshot/build-snapshot";
import { getActiveAssistant } from "@/lib/config/env";
import { createAnthropicRuntime, CHAT_LIMITS } from "@/lib/ai/anthropic-client";
import {
  callGemini,
  GEMINI_LIMITS,
  type GeminiContent,
  type GeminiPart,
} from "@/lib/ai/gemini-client";
import { GEMINI_FUNCTION_DECLARATIONS } from "@/lib/ai/gemini-tools";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { TOOL_DEFINITIONS } from "@/lib/ai/tool-definitions";
import { executeTool, type ToolAuditEntry } from "@/lib/ai/tool-runner";
import { buildOfflineSummary } from "@/lib/ai/offline-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
function sse(obj: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "BAD_JSON", "Malformed request body.");
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(422, "VALIDATION_FAILED", "Invalid chat request.");
  }

  const { messages, mode, scenario } = parsed.data;

  // Enforce input-length + history limits (§6).
  const trimmed = messages.slice(-CHAT_LIMITS.maxHistoryMessages).map((m) => ({
    role: m.role,
    content: m.content.slice(0, CHAT_LIMITS.maxUserMessageChars),
  }));
  const lastUser = [...trimmed].reverse().find((m) => m.role === "user");

  // Build the shared snapshot for this mode/scenario.
  const sp = new URLSearchParams();
  if (mode) sp.set("mode", mode);
  if (scenario) sp.set("scenario", scenario);
  const snapshot = await buildSnapshot(resolveSnapshotOptions(sp));

  const assistant = getActiveAssistant();

  // ── Offline path: no API key. Stream a deterministic, labelled summary. ──
  if (!assistant.enabled) {
    const summary = buildOfflineSummary(snapshot, lastUser?.content ?? "");
    return streamText(summary, [], { offline: true });
  }

  // ── Gemini live path (Google AI Studio free tier). ──
  // The agentic loop runs INSIDE the stream so the client sees each tool the
  // agent calls in real time ("live agent thinking"), not just the final text.
  if (assistant.provider === "gemini") {
    const system = buildSystemPrompt(snapshot);
    const contents: GeminiContent[] = trimmed.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(sse(obj));
        const audit: ToolAuditEntry[] = [];
        let finalText = "";
        try {
          send({ type: "status", message: "assistant" });

          for (let loop = 0; loop < GEMINI_LIMITS.maxToolLoops; loop++) {
            send({ type: "thinking" });
            const resp = await callGemini({
              system_instruction: { parts: [{ text: system }] },
              contents,
              tools: [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS }],
              toolConfig: { functionCallingConfig: { mode: "AUTO" } },
              generationConfig: {
                maxOutputTokens: GEMINI_LIMITS.maxOutputTokens,
                temperature: 0.2,
              },
            });

            const parts = resp.candidates?.[0]?.content?.parts ?? [];
            const calls = parts.filter((p) => p.functionCall);
            const textNow = parts
              .filter((p) => typeof p.text === "string")
              .map((p) => p.text)
              .join("");
            if (textNow) finalText = textNow;

            if (calls.length === 0) break;

            contents.push({ role: "model", parts });
            const responseParts: GeminiPart[] = [];
            for (const call of calls) {
              const fc = call.functionCall!;
              // Emit the tool step BEFORE executing it — this is the live status.
              send({ type: "tool", name: fc.name });
              const exec = executeTool(fc.name, fc.args, snapshot);
              audit.push(exec.audit);
              responseParts.push({
                functionResponse: {
                  name: fc.name,
                  response: { result: exec.content },
                },
              });
            }
            contents.push({ role: "user", parts: responseParts });
          }

          if (!finalText) {
            finalText =
              "I couldn't complete the analysis within the tool-loop limit. Please retry or narrow the question.";
          }

          const chunkSize = 280;
          for (let i = 0; i < finalText.length; i += chunkSize) {
            send({ type: "delta", text: finalText.slice(i, i + chunkSize) });
          }
          send({ type: "done", audit, offline: false, error: false });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Assistant request failed.";
          send({
            type: "delta",
            text: `The assistant encountered an error: ${message}\n\nThe dashboard figures remain available and were computed deterministically.`,
          });
          send({ type: "done", audit, offline: false, error: true });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // ── Anthropic (Claude) live path: agentic tool loop, then stream. ──
  try {
    const rt = createAnthropicRuntime();
    const system = buildSystemPrompt(snapshot);
    const convo: Anthropic.MessageParam[] = trimmed.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const audit: ToolAuditEntry[] = [];
    let finalText = "";

    for (let loop = 0; loop < CHAT_LIMITS.maxToolLoops; loop++) {
      const resp: Anthropic.Message = await rt.client.messages.create({
        model: rt.model,
        max_tokens: CHAT_LIMITS.maxOutputTokens,
        system,
        tools: TOOL_DEFINITIONS as unknown as Anthropic.Tool[],
        messages: convo,
      });

      convo.push({ role: "assistant", content: resp.content });

      const toolUses = resp.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      const textNow = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (textNow) finalText = textNow;

      if (resp.stop_reason !== "tool_use" || toolUses.length === 0) break;

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const exec = executeTool(tu.name, tu.input, snapshot);
        audit.push(exec.audit);
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(exec.content).slice(0, 12000),
          is_error: !exec.ok,
        });
      }
      convo.push({ role: "user", content: toolResults });
    }

    if (!finalText) {
      finalText =
        "I was unable to complete the analysis within the tool-loop limit. Please retry or narrow the question.";
    }
    return streamText(finalText, audit, { offline: false });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Assistant request failed.";
    return streamText(
      `The assistant encountered an error: ${message}\n\nThe dashboard figures remain available and were computed deterministically.`,
      [],
      { offline: false, error: true },
    );
  }
}

/** Stream text to the client in small chunks as Server-Sent Events. */
function streamText(
  text: string,
  audit: ToolAuditEntry[],
  meta: { offline: boolean; error?: boolean },
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        sse({ type: "status", message: meta.offline ? "offline-summary" : "assistant" }),
      );
      const chunkSize = 280;
      for (let i = 0; i < text.length; i += chunkSize) {
        controller.enqueue(sse({ type: "delta", text: text.slice(i, i + chunkSize) }));
      }
      controller.enqueue(
        sse({ type: "done", audit, offline: meta.offline, error: meta.error ?? false }),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
