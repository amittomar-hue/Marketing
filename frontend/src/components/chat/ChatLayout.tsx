"use client";

import { useChatStore } from "@/lib/chat-store";
import Sidebar from "./Sidebar";
import WelcomeScreen from "./WelcomeScreen";
import MessageThread from "./MessageThread";
import InputBar from "./InputBar";
import { getModel } from "@/lib/models";
import { Share, MoreHorizontal } from "lucide-react";

export default function ChatLayout() {
  const conv = useChatStore((s) => s.activeConversation());
  const selectedModel = useChatStore((s) => s.selectedModel);
  const current = getModel(selectedModel);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b border-[#ececec] bg-[#f9f9f8] flex items-center justify-between px-5 shrink-0">
          <span className="text-sm text-[#5a5a5a] truncate">
            {conv ? conv.title : current.label}
          </span>
          <div className="flex items-center gap-1">
            <button className="px-2.5 py-1 rounded-md hover:bg-[#ececec] text-[#5a5a5a] text-sm flex items-center gap-1.5">
              <Share size={13} /> Share
            </button>
            <button className="p-1.5 rounded-md hover:bg-[#ececec] text-[#5a5a5a]">
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
        <div className="shrink-0">
          <InputBar />
        </div>
      </main>
    </div>
  );
}
