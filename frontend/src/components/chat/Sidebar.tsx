"use client";

import { useChatStore, Conversation } from "@/lib/chat-store";
import { SquarePen, MessageSquare, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

function groupByDate(conversations: Conversation[]) {
  const now = new Date();
  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const older: Conversation[] = [];

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
      <div className="mb-3">
        <p className="px-3 py-1.5 text-[10px] font-semibold text-[var(--dmoop-text-tertiary)] uppercase tracking-[0.08em]">
          {label}
        </p>
        <div className="flex flex-col gap-0.5">
          {items.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              style={{ animationDelay: `${i * 30}ms` }}
              className={cn(
                "group relative w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] transition-all duration-200 dmoop-stagger-in",
                activeId === c.id
                  ? "bg-white text-[var(--dmoop-text-primary)] shadow-[0_1px_3px_rgba(78,52,32,0.06),0_4px_12px_rgba(78,52,32,0.05)]"
                  : "text-[var(--dmoop-text-secondary)] hover:bg-white/60 hover:translate-x-0.5"
              )}
            >
              {activeId === c.id && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-[var(--dmoop-accent)]" />
              )}
              <MessageSquare size={13} className="shrink-0 opacity-60" />
              <span className="flex-1 truncate font-medium">{c.title}</span>
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <aside
      className="w-[268px] shrink-0 flex flex-col h-full border-r border-[var(--dmoop-border-soft)]"
      style={{ background: "var(--dmoop-bg-sidebar)" }}
    >
      {/* Logo / brand */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div
            className="relative w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "var(--dmoop-gradient-accent)",
              boxShadow: "var(--dmoop-shadow-accent)",
            }}
          >
            <Sparkles size={16} className="text-white drop-shadow-sm" />
            <span className="absolute inset-0 rounded-xl bg-[var(--dmoop-gradient-sheen)] opacity-50 pointer-events-none" />
          </div>
          <div>
            <h1 className="font-bold text-[15px] tracking-tight text-[var(--dmoop-text-primary)] leading-none">
              DMOOP
            </h1>
            <p className="text-[10px] text-[var(--dmoop-text-tertiary)] tracking-wider font-medium mt-0.5">
              ENTERPRISE
            </p>
          </div>
        </div>
        <button
          onClick={() => newConversation()}
          className="p-2 rounded-lg text-[var(--dmoop-text-secondary)] transition-all duration-200 hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] hover:text-[var(--dmoop-text-primary)] active:scale-95"
          title="New conversation"
        >
          <SquarePen size={15} />
        </button>
      </div>

      <div className="mx-4 mb-3 h-px bg-gradient-to-r from-transparent via-[var(--dmoop-border-soft)] to-transparent" />

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 dmoop-scroll">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-[var(--dmoop-text-tertiary)] leading-relaxed">
              Start a conversation to see it here.
            </p>
          </div>
        ) : (
          <>
            <Section label="Today" items={groups.today} />
            <Section label="Yesterday" items={groups.yesterday} />
            <Section label="Older" items={groups.older} />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--dmoop-border-soft)] p-2">
        <button className="w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-[var(--dmoop-text-secondary)] transition-all duration-200 hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)]">
          <div
            className="w-8 h-8 rounded-full text-white text-xs flex items-center justify-center font-semibold shrink-0"
            style={{
              background: "var(--dmoop-gradient-accent)",
              boxShadow: "var(--dmoop-shadow-sm)",
            }}
          >
            A
          </div>
          <span className="flex-1 text-left text-[13px] truncate font-medium text-[var(--dmoop-text-primary)]">
            Amit Tomar
          </span>
          <Settings size={13} className="opacity-50" />
        </button>
      </div>
    </aside>
  );
}
