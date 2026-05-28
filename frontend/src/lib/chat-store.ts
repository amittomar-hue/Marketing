"use client";

import { create } from "zustand";
import { ModelId, DEFAULT_MODEL } from "./models";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: ModelId;
  createdAt: Date;
  isStreaming?: boolean;
  interactionId?: string;     // server-side ID for feedback
  userRating?: 1 | -1 | null; // local UI state for thumbs-up/down
}

export interface Conversation {
  id: string;
  title: string;
  model: ModelId;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  selectedModel: ModelId;
  setModel: (model: ModelId) => void;
  newConversation: () => string;
  setActive: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, "id" | "createdAt">) => string;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<Message>) => void;
  activeConversation: () => Conversation | null;
}

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeId: null,
  selectedModel: DEFAULT_MODEL,

  setModel: (model) => set({ selectedModel: model }),

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

  activeConversation: () => {
    const { conversations, activeId } = get();
    return conversations.find((c) => c.id === activeId) ?? null;
  },
}));
