"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ModelId, DEFAULT_MODEL } from "./models";

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
}

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      selectedModel: DEFAULT_MODEL,
      webSearchForced: "auto",
      pendingAttachment: null,

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
        return id;
      },

      deleteConversation: (id) => {
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        }));
      },

      renameConversation: (id, title) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          ),
        }));
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
                }
              : c
          ),
        }));
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
      },

      activeConversation: () => {
        const { conversations, activeId } = get();
        return conversations.find((c) => c.id === activeId) ?? null;
      },

      clearAll: () => set({ conversations: [], activeId: null }),
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
