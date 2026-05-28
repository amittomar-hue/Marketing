"use client";

import { useChatStore, Conversation } from "@/lib/chat-store";
import { Zap, SquarePen, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

function groupByDate(conversations: Conversation[]) {
  const now = new Date();
  const today: typeof conversations = [];
  const yesterday: typeof conversations = [];
  const older: typeof conversations = [];

  for (const c of conversations) {
    const diff = (now.getTime() - new Date(c.updatedAt).getTime()) / 86400000;
    if (diff < 1) today.push(c);
    else if (diff < 2) yesterday.push(c);
    else older.push(c);
  }
  return { today, yesterday, older };
}

export default function Sidebar() {
  const { conversations, activeId, newConversation, setActive } = useChatStore();
  const groups = groupByDate(conversations);

  const Section = ({
    label,
    items,
  }: {
    label: string;
    items: Conversation[];
  }) =>
    items.length > 0 ? (
      <div className="mb-2">
        <p className="px-3 py-1.5 text-[11px] font-medium text-[#8a8a8a] uppercase tracking-wider">
          {label}
        </p>
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className={cn(
              "group w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
              activeId === c.id
                ? "bg-[#ebebeb] text-[#1a1a1a]"
                : "text-[#3d3d3d] hover:bg-[#f0f0f0]"
            )}
          >
            <MessageSquare size={14} className="shrink-0 opacity-50" />
            <span className="flex-1 truncate">{c.title}</span>
          </button>
        ))}
      </div>
    ) : null;

  return (
    <aside className="w-[260px] shrink-0 flex flex-col bg-[#f0ede8] h-full border-r border-[#e5e0d8]">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#c96442] flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm text-[#1a1a1a]">Marketing LLM</span>
        </div>
        <button
          onClick={() => newConversation()}
          className="p-1.5 rounded-lg hover:bg-[#e5e0d8] transition-colors"
          title="New conversation"
        >
          <SquarePen size={15} className="text-[#5a5a5a]" />
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin">
        {conversations.length === 0 ? (
          <p className="text-xs text-[#999] text-center mt-8 px-4">
            No conversations yet. Start one below.
          </p>
        ) : (
          <>
            <Section label="Today" items={groups.today} />
            <Section label="Yesterday" items={groups.yesterday} />
            <Section label="Older" items={groups.older} />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#e5e0d8] p-2">
        <button className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#3d3d3d] hover:bg-[#e5e0d8] transition-colors">
          <div className="w-7 h-7 rounded-full bg-[#c96442] text-white text-xs flex items-center justify-center font-medium shrink-0">
            A
          </div>
          <span className="flex-1 text-left text-sm truncate">Amit Tomar</span>
          <Settings size={13} className="opacity-50" />
        </button>
      </div>
    </aside>
  );
}
