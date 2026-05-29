"use client";

import { useChatStore } from "@/lib/chat-store";
import Sidebar from "./Sidebar";
import WelcomeScreen from "./WelcomeScreen";
import MessageThread from "./MessageThread";
import InputBar from "./InputBar";
import { getModel } from "@/lib/models";
import { Share2, MoreHorizontal, Sparkles } from "lucide-react";

export default function ChatLayout() {
  const conv = useChatStore((s) => s.activeConversation());
  const selectedModel = useChatStore((s) => s.selectedModel);
  const current = getModel(selectedModel);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--dmoop-bg-app)]">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {/* Ambient background glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none opacity-40"
          style={{
            background: "radial-gradient(ellipse at top, rgba(193, 74, 42, 0.08) 0%, transparent 70%)",
          }}
        />

        {/* Top bar */}
        <header
          className="h-14 flex items-center justify-between px-6 shrink-0 relative z-10"
          style={{
            background: "rgba(250, 248, 245, 0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--dmoop-border-soft)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} className={current.color} strokeWidth={2.2} />
              <span className="text-[13px] text-[var(--dmoop-text-secondary)] font-medium">
                {conv ? conv.title : current.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[var(--dmoop-text-secondary)] text-[13px] font-medium transition-all duration-200 hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] hover:text-[var(--dmoop-text-primary)] active:scale-95">
              <Share2 size={13} strokeWidth={2.2} /> Share
            </button>
            <button className="p-2 rounded-lg text-[var(--dmoop-text-secondary)] transition-all duration-200 hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] active:scale-95">
              <MoreHorizontal size={14} />
            </button>
          </div>
        </header>

        {/* Body */}
        {!conv || conv.messages.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <MessageThread />
        )}

        {/* Input */}
        <div className="shrink-0 relative z-10">
          <InputBar />
        </div>
      </main>
    </div>
  );
}
