"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ModelId, DEFAULT_MODEL } from "./models";
import { createSupabaseBrowserClient } from "./supabase-browser";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: ModelId;
  createdAt: Date | string;
  isStreaming?: boolean;
  interactionId?: string;
  userRating?: 1 | -1 | null;
  attachmentName?: string;
  /** If the user asked for a specific file format (pdf/docx/xlsx/pptx/csv/json/md/txt/html), it's stored here so the assistant message can show a Download button. */
  requestedFormat?: string;
  /** The verbatim text used to derive the filename when downloading. */
  formatPromptHint?: string;
  /** For "convert this to X" follow-ups: the prior message's content used as the actual export payload (so the downloadable file contains the real answer, not the thin acknowledgment text). */
  conversionSource?: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: ModelId;
  messages: Message[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  selectedModel: ModelId;
  webSearchForced: "auto" | "on" | "off";
  pendingAttachment: { name: string; content: string } | null;
  /** Auth user the store is currently bound to. null = signed out / not yet hydrated. */
  userId: string | null;
  /** True while the initial server fetch is in flight (sidebar shows a skeleton). */
  isHydrating: boolean;
  setModel: (model: ModelId) => void;
  setWebSearchMode: (mode: "auto" | "on" | "off") => void;
  setPendingAttachment: (att: { name: string; content: string } | null) => void;
  newConversation: () => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setActive: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, "id" | "createdAt">) => string;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<Message>) => void;
  /** Drop every message strictly AFTER the given message id. Used when a user
   *  edits an earlier prompt — the assistant reply (and any follow-ups) get
   *  removed so the new regenerated response can replace them. */
  truncateAfter: (conversationId: string, messageId: string) => void;
  activeConversation: () => Conversation | null;
  clearAll: () => void;
  /** Replace in-memory conversations with the user's rows from Supabase.
   *  Idempotent — safe to call repeatedly on auth state change. Existing
   *  localStorage-only chats are discarded (server is authoritative). */
  hydrateFromServer: (userId: string) => Promise<void>;
  /** Wipe in-memory state when the user signs out, so the next user
   *  doesn't briefly see the previous user's conversations. */
  unbind: () => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

// ─────────────────────────────────────────────────────────────────
// Server sync: each conversation is a single row keyed by its id
// in the chat_conversations table. Writes are debounced per-conversation
// so a burst of updateMessage calls during streaming only produces
// one network round-trip when the stream settles.
// ─────────────────────────────────────────────────────────────────

const SYNC_DEBOUNCE_MS = 600;
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSync(conversationId: string) {
  if (typeof window === "undefined") return;
  const existing = syncTimers.get(conversationId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    syncTimers.delete(conversationId);
    void syncConversationToServer(conversationId);
  }, SYNC_DEBOUNCE_MS);
  syncTimers.set(conversationId, t);
}

async function syncConversationToServer(conversationId: string) {
  const state = useChatStore.getState();
  const userId = state.userId;
  if (!userId) return;
  const convo = state.conversations.find((c) => c.id === conversationId);
  if (!convo) return;

  const sb = createSupabaseBrowserClient();
  // Don't sync a streaming message — wait for the stream to settle.
  // Streaming messages flip isStreaming back to undefined when the
  // chat route finishes, at which point the next scheduleSync fires.
  const hasStreaming = convo.messages.some((m) => m.isStreaming);
  if (hasStreaming) {
    scheduleSync(conversationId);
    return;
  }

  const updatedAtIso =
    convo.updatedAt instanceof Date ? convo.updatedAt.toISOString() : new Date(convo.updatedAt).toISOString();
  const createdAtIso =
    convo.createdAt instanceof Date ? convo.createdAt.toISOString() : new Date(convo.createdAt).toISOString();

  const { error } = await sb.from("chat_conversations").upsert(
    {
      id: convo.id,
      user_id: userId,
      title: convo.title,
      model: convo.model,
      data: convo,
      created_at: createdAtIso,
      updated_at: updatedAtIso,
    },
    { onConflict: "id" }
  );
  if (error) {
    console.error("chat-store: sync upsert failed", error.message);
  }
}

async function deleteConversationOnServer(conversationId: string) {
  const userId = useChatStore.getState().userId;
  if (!userId) return;
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (error) console.error("chat-store: delete failed", error.message);
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      selectedModel: DEFAULT_MODEL,
      webSearchForced: "auto",
      pendingAttachment: null,
      userId: null,
      isHydrating: false,

      setModel: (model) => set({ selectedModel: model }),
      setWebSearchMode: (mode) => set({ webSearchForced: mode }),
      setPendingAttachment: (att) => set({ pendingAttachment: att }),

      newConversation: () => {
        const id = uid();
        const conv: Conversation = {
          id,
          title: "New conversation",
          model: get().selectedModel,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((s) => ({ conversations: [conv, ...s.conversations], activeId: id }));
        scheduleSync(id);
        return id;
      },

      deleteConversation: (id) => {
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        }));
        void deleteConversationOnServer(id);
      },

      renameConversation: (id, title) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: new Date() } : c
          ),
        }));
        scheduleSync(id);
      },

      setActive: (id) => set({ activeId: id }),

      addMessage: (conversationId, msg) => {
        const id = uid();
        const message: Message = { ...msg, id, createdAt: new Date() };
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  title:
                    c.messages.length === 0 && msg.role === "user"
                      ? msg.content.slice(0, 48) + (msg.content.length > 48 ? "…" : "")
                      : c.title,
                  updatedAt: new Date(),
                }
              : c
          ),
        }));
        scheduleSync(conversationId);
        return id;
      },

      updateMessage: (conversationId, messageId, patch) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, ...patch } : m
                  ),
                  updatedAt: new Date(),
                }
              : c
          ),
        }));
        scheduleSync(conversationId);
      },

      truncateAfter: (conversationId, messageId) => {
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const idx = c.messages.findIndex((m) => m.id === messageId);
            if (idx < 0) return c;
            return {
              ...c,
              messages: c.messages.slice(0, idx + 1),
              updatedAt: new Date(),
            };
          }),
        }));
        scheduleSync(conversationId);
      },

      activeConversation: () => {
        const { conversations, activeId } = get();
        return conversations.find((c) => c.id === activeId) ?? null;
      },

      clearAll: () => set({ conversations: [], activeId: null }),

      // ─────────────────────────────────────────────────────────
      // Cross-device sync: server is authoritative. Replace the
      // in-memory list with whatever Supabase has for this user.
      // Existing localStorage conversations (from before the
      // rollout) are discarded — same-user-same-list on every
      // device beats preserving silo'd browser history.
      // ─────────────────────────────────────────────────────────
      hydrateFromServer: async (userId: string) => {
        set({ userId, isHydrating: true, conversations: [], activeId: null });

        const sb = createSupabaseBrowserClient();
        const { data, error } = await sb
          .from("chat_conversations")
          .select("id, data, updated_at")
          .order("updated_at", { ascending: false });

        if (error) {
          console.error("chat-store: hydrate fetch failed", error.message);
          set({ isHydrating: false });
          return;
        }

        const serverConvos: Conversation[] = (data ?? [])
          .map((row) => row.data as Conversation)
          .filter(Boolean);

        set({ conversations: serverConvos, isHydrating: false });
      },

      unbind: () => {
        set({ conversations: [], activeId: null, userId: null });
      },
    }),
    {
      name: "dmoop-chat-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        conversations: state.conversations,
        activeId: state.activeId,
        selectedModel: state.selectedModel,
        webSearchForced: state.webSearchForced,
      }),
      version: 1,
    }
  )
);
