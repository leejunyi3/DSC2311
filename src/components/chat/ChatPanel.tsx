"use client";

import { useRef, useState } from "react";
import {
  Send,
  Copy,
  Trash2,
  RotateCcw,
  Bot,
  User,
  Plus,
  MessageSquare,
} from "lucide-react";
import { useAppState } from "@/components/providers/AppStateProvider";
import {
  useChatSessions,
  type StoredMessage,
} from "@/lib/client/useChatSessions";
import { formatSgTime } from "@/lib/utils/time";
import { SafeMarkdown } from "./SafeMarkdown";

const SUGGESTIONS = [
  "What is currently affecting Tuas Mega Port?",
  "What is driving the current risk score?",
  "Is there evidence of congestion near Tuas?",
  "Could the current weather affect operations?",
  "Are there disruptions in the Malacca Strait?",
  "How reliable is the current information?",
  "Which sources are unavailable or stale?",
  "What should we do about a critical pharmaceutical shipment?",
  "Compare waiting, rerouting and emergency replenishment.",
  "How would a 36-hour delay affect safety stock?",
  "Which assumptions have the greatest effect on the recommendation?",
];

export function ChatPanel() {
  const { mode, scenario } = useAppState();
  const {
    chats,
    activeId,
    activeChat,
    newChat,
    selectChat,
    deleteChat,
    setMessages,
  } = useChatSessions();

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastUserRef = useRef<string>("");

  const messages = activeChat?.messages ?? [];

  function startNewChat() {
    // Don't spawn a duplicate empty chat if one is already active + empty.
    if (activeChat && activeChat.messages.length === 0) return;
    newChat();
    setError(null);
  }

  async function send(question: string) {
    const q = question.trim();
    if (!q || streaming) return;
    setError(null);
    lastUserRef.current = q;

    // Resolve the target chat (create one on first message).
    const id = activeId ?? newChat();
    const base: StoredMessage[] = id === activeId ? messages : [];

    // What we SEND (no empty placeholder) vs what we DISPLAY (with placeholder).
    const sendMessages: StoredMessage[] = [...base, { role: "user", content: q }];
    const working: StoredMessage[] = [
      ...sendMessages,
      { role: "assistant", content: "" },
    ];
    setMessages(id, working);
    setInput("");
    setStreaming(true);
    setStatus("thinking");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: sendMessages, mode, scenario }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`Assistant request failed (${res.status}).`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as {
            type: string;
            text?: string;
            message?: string;
          };
          if (payload.type === "status") setStatus(payload.message ?? null);
          if (payload.type === "delta" && payload.text) {
            assistantText += payload.text;
            working[working.length - 1] = {
              role: "assistant",
              content: assistantText,
            };
            setMessages(id, [...working]);
          }
          if (payload.type === "done") setStatus(null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assistant error.");
      // Drop the empty assistant placeholder on failure.
      setMessages(id, sendMessages);
    } finally {
      setStreaming(false);
      setStatus(null);
    }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] gap-3">
      {/* ── Chat list (desktop) ── */}
      <aside className="hidden w-56 shrink-0 flex-col rounded-xl border border-base-600 bg-base-800 p-2 md:flex">
        <button
          onClick={startNewChat}
          className="mb-2 flex items-center justify-center gap-1.5 rounded-lg bg-status-live/20 px-3 py-2 text-xs font-semibold text-status-live hover:bg-status-live/30"
        >
          <Plus className="h-3.5 w-3.5" /> New chat
        </button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {chats.length === 0 && (
            <p className="px-2 py-4 text-center text-[11px] text-slate-500">
              No saved chats yet. Ask a question to start one.
            </p>
          )}
          {chats.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 ${c.id === activeId ? "bg-base-600" : "hover:bg-base-700"}`}
            >
              <button
                onClick={() => selectChat(c.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-slate-200">
                    {c.title}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {formatSgTime(new Date(c.updatedAt).toISOString(), "dd MMM HH:mm")}
                  </span>
                </span>
              </button>
              <button
                onClick={() => deleteChat(c.id)}
                title="Delete chat"
                className="shrink-0 rounded p-1 text-slate-500 opacity-0 hover:text-status-high group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Conversation ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-white">
              {activeChat?.title && activeChat.messages.length > 0
                ? activeChat.title
                : "AI Resilience Assistant"}
            </h1>
            <p className="truncate text-xs text-slate-400">
              Tuas Port Resilience Orchestrator · {mode.toUpperCase()} mode ·
              grounded in the live snapshot
            </p>
          </div>

          {/* Mobile chat controls */}
          <div className="flex items-center gap-1.5 md:hidden">
            <select
              value={activeId ?? ""}
              onChange={(e) => selectChat(e.target.value)}
              className="max-w-[9rem] rounded-lg border border-base-500 bg-base-700 px-2 py-1.5 text-xs text-slate-200"
              aria-label="Select chat"
            >
              {chats.length === 0 && <option value="">No chats</option>}
              {chats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <button
              onClick={startNewChat}
              className="rounded-lg border border-base-500 p-1.5 text-status-live"
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </button>
            {activeId && (
              <button
                onClick={() => deleteChat(activeId)}
                className="rounded-lg border border-base-500 p-1.5 text-slate-400 hover:text-status-high"
                title="Delete chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-base-600 bg-base-800 p-4">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-base-500 bg-base-700 px-3 py-1.5 text-left text-xs text-slate-300 hover:border-status-live/50 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className="flex gap-3">
              <div
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-status-live/20 text-status-live" : "bg-purple-500/20 text-status-sim"}`}
              >
                {m.role === "user" ? (
                  <User className="h-3.5 w-3.5" />
                ) : (
                  <Bot className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {m.role === "user" ? (
                  <p className="text-sm text-slate-200">{m.content}</p>
                ) : m.content ? (
                  <div className="group relative">
                    <SafeMarkdown text={m.content} />
                    <button
                      onClick={() => navigator.clipboard?.writeText(m.content)}
                      className="absolute right-0 top-0 hidden rounded p-1 text-slate-500 hover:text-white group-hover:block"
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    {status === "thinking" ? "Analysing snapshot…" : (status ?? "…")}
                  </p>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 text-sm text-status-high">
              {error}
              <button
                onClick={() => send(lastUserRef.current)}
                className="flex items-center gap-1 text-xs text-slate-300 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Tuas Port resilience…"
            maxLength={4000}
            className="flex-1 rounded-lg border border-base-500 bg-base-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-status-live/20 px-4 py-2 text-sm font-semibold text-status-live hover:bg-status-live/30 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
