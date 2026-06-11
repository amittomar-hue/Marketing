"use client";

// ─────────────────────────────────────────────────────────────────
// Brand Agents store — server-authoritative list of the signed-in
// user's agents plus a session-scoped "selected" pointer that drives
// the chat header switcher and is used as the default agent for new
// conversations. Not persisted to localStorage: agents come from the
// chat_conversations / brand_agents tables on every load, and the
// selected pointer falls back to the user's default-flagged agent.
//
// Keep this store small. Conversation-level binding lives in chat-store
// (Conversation.agentId); this store only tracks the *user-level*
// preference for what a new conversation should inherit.
// ─────────────────────────────────────────────────────────────────

import { create } from "zustand";
import type { VoiceProfile } from "./voice-profile";

export interface BrandAgent {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
  doc_count: number;
  created_at?: string;
  updated_at?: string;
  /** Structured brand voice — extracted from this agent's uploaded brand
   *  docs by a Groq 70B pass after every upload (and on manual refresh
   *  via the agents page). NULL = never extracted / new agent. */
  voice_profile?: VoiceProfile | null;
  voice_profile_updated_at?: string | null;
}

interface AgentState {
  agents: BrandAgent[];
  selectedAgentId: string | null;
  isLoading: boolean;
  /** Pull the user's agents from the server. Falls back to the
   *  default-flagged agent as the selected one if nothing is selected
   *  yet (or the previously-selected agent was deleted). */
  refresh: () => Promise<void>;
  setSelected: (agentId: string | null) => void;
  /** Update an agent in place after a PATCH (rename / recolor / set
   *  default) without re-fetching the whole list. */
  upsert: (agent: BrandAgent) => void;
  /** Drop an agent locally after a successful DELETE. */
  remove: (agentId: string) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  selectedAgentId: null,
  isLoading: false,

  refresh: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/brand/agents", { credentials: "include" });
      if (!res.ok) {
        set({ isLoading: false });
        return;
      }
      const json = await res.json();
      const agents: BrandAgent[] = json.agents ?? [];
      const prevSelected = get().selectedAgentId;
      // Preserve current selection if it still exists; otherwise fall
      // back to the default-flagged agent.
      const stillExists = agents.some((a) => a.id === prevSelected);
      const fallback = agents.find((a) => a.is_default)?.id ?? agents[0]?.id ?? null;
      set({
        agents,
        selectedAgentId: stillExists ? prevSelected : fallback,
        isLoading: false,
      });
    } catch (e) {
      console.error("agent-store: refresh failed", e);
      set({ isLoading: false });
    }
  },

  setSelected: (agentId) => set({ selectedAgentId: agentId }),

  upsert: (agent) => {
    set((s) => {
      const idx = s.agents.findIndex((a) => a.id === agent.id);
      const next = [...s.agents];
      if (idx >= 0) {
        // If the incoming agent flipped is_default=true, clear any other
        // local default so the UI doesn't briefly show two defaults
        // before the next refresh().
        const merged = agent.is_default
          ? next.map((a) => (a.id === agent.id ? agent : { ...a, is_default: false }))
          : next.map((a) => (a.id === agent.id ? agent : a));
        return { agents: merged };
      }
      return { agents: [agent, ...next] };
    });
  },

  remove: (agentId) => {
    set((s) => {
      const filtered = s.agents.filter((a) => a.id !== agentId);
      const newSelected =
        s.selectedAgentId === agentId
          ? filtered.find((a) => a.is_default)?.id ?? filtered[0]?.id ?? null
          : s.selectedAgentId;
      return { agents: filtered, selectedAgentId: newSelected };
    });
  },
}));
