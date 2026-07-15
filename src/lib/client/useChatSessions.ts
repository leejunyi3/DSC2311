"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Client-side multi-chat store for the assistant. Conversations autosave to
 * localStorage (no backend), can be switched between, and deleted. Mirrors the
 * app's other client persistence (mode/scenario) — everything stays in the
 * browser.
 */

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
}

const CHATS_KEY = "tuas.chats.v1";
const ACTIVE_KEY = "tuas.chats.active.v1";
const NEW_TITLE = "New chat";

function loadFromStorage(): { chats: ChatSession[]; activeId: string | null } {
  try {
    const raw = window.localStorage.getItem(CHATS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const chats = Array.isArray(parsed) ? (parsed as ChatSession[]) : [];
    const activeId = window.localStorage.getItem(ACTIVE_KEY);
    return { chats, activeId };
  } catch {
    return { chats: [], activeId: null };
  }
}

function persist(chats: ChatSession[], activeId: string | null): void {
  try {
    window.localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    if (activeId) window.localStorage.setItem(ACTIVE_KEY, activeId);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // storage full / unavailable — ignore; chat still works in-memory this session
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function deriveTitle(messages: StoredMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return NEW_TITLE;
  const t = first.content.trim().replace(/\s+/g, " ");
  if (!t) return NEW_TITLE;
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
}

export interface ChatSessionsApi {
  ready: boolean;
  chats: ChatSession[];
  activeId: string | null;
  activeChat: ChatSession | null;
  /** Create a new empty chat and make it active. Returns its id. */
  newChat: () => string;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => void;
  /** Replace the messages of a specific chat (autosaves + titles it). */
  setMessages: (id: string, messages: StoredMessage[]) => void;
}

export function useChatSessions(): ChatSessionsApi {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Restore after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    const loaded = loadFromStorage();
    setChats(loaded.chats);
    const valid =
      loaded.activeId && loaded.chats.some((c) => c.id === loaded.activeId)
        ? loaded.activeId
        : (loaded.chats[0]?.id ?? null);
    setActiveId(valid);
    setReady(true);
  }, []);

  // Autosave.
  useEffect(() => {
    if (ready) persist(chats, activeId);
  }, [chats, activeId, ready]);

  const newChat = useCallback((): string => {
    const id = newId();
    const now = Date.now();
    setChats((prev) => [
      { id, title: NEW_TITLE, messages: [], createdAt: now, updatedAt: now },
      ...prev,
    ]);
    setActiveId(id);
    return id;
  }, []);

  const selectChat = useCallback((id: string) => setActiveId(id), []);

  const deleteChat = useCallback((id: string) => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      setActiveId((cur) => (cur === id ? (next[0]?.id ?? null) : cur));
      return next;
    });
  }, []);

  const setMessages = useCallback((id: string, messages: StoredMessage[]) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              messages,
              updatedAt: Date.now(),
              title: c.title === NEW_TITLE ? deriveTitle(messages) : c.title,
            }
          : c,
      ),
    );
  }, []);

  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  const activeChat = chats.find((c) => c.id === activeId) ?? null;

  return {
    ready,
    chats: sorted,
    activeId,
    activeChat,
    newChat,
    selectChat,
    deleteChat,
    setMessages,
  };
}
