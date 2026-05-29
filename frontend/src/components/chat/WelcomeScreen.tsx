"use client";

import { useChatStore } from "@/lib/chat-store";
import { streamChat } from "@/lib/stream-chat";
import { TrendingUp, Wand2, Mail, Target, Mic2, Crosshair } from "lucide-react";

const SUGGESTIONS = [
  {
    icon: Wand2,
    accent: "from-violet-500 to-fuchsia-500",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    title: "Generate ad copy",
    prompt: "Write 3 Google Ads variants for a B2B SaaS marketing platform targeting growth marketers.",
  },
  {
    icon: TrendingUp,
    accent: "from-blue-500 to-cyan-500",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    title: "Show me trending topics",
    prompt: "What are the top marketing trends I should know about this week?",
  },
  {
    icon: Mail,
    accent: "from-emerald-500 to-teal-500",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    title: "Write an email sequence",
    prompt: "Draft a 5-email product launch sequence for a marketing automation tool.",
  },
  {
    icon: Target,
    accent: "from-amber-500 to-orange-500",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    title: "Build a GTM strategy",
    prompt: "Help me build a 90-day go-to-market strategy for launching into the mid-market segment.",
  },
  {
    icon: Mic2,
    accent: "from-pink-500 to-rose-500",
    iconBg: "bg-pink-50",
    iconColor: "text-pink-600",
    title: "Score copy against my brand",
    prompt: "Score this copy against my brand voice: 'The world-class, guaranteed cheapest solution your team will love.'",
  },
  {
    icon: Crosshair,
    accent: "from-rose-500 to-red-500",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    title: "Analyze a competitor",
    prompt: "Analyze a competitor's recent campaign and suggest 3 counter-positioning strategies.",
  },
];

export default function WelcomeScreen() {
  const { newConversation, addMessage, updateMessage, selectedModel } = useChatStore();

  const startWith = async (prompt: string) => {
    const id = newConversation();
    addMessage(id, { role: "user", content: prompt });
    const asstId = addMessage(id, {
      role: "assistant",
      content: "",
      model: selectedModel,
      isStreaming: true,
    });
    try {
      const { text, interactionId } = await streamChat({
        messages: [{ id: "u", role: "user", content: prompt, createdAt: new Date() }],
        model: selectedModel,
        onToken: (acc) => updateMessage(id, asstId, { content: acc }),
      });
      updateMessage(id, asstId, {
        content: text,
        isStreaming: false,
        interactionId: interactionId ?? undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateMessage(id, asstId, { content: `⚠️ ${msg}`, isStreaming: false });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto dmoop-scroll min-h-0">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-3xl dmoop-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-[var(--dmoop-border-soft)] shadow-[var(--dmoop-shadow-xs)] mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              <span className="text-[11px] font-semibold text-[var(--dmoop-text-secondary)] tracking-wide uppercase">
                Live · Self-Learning
              </span>
            </div>
            <h1 className="text-[36px] sm:text-[40px] font-light tracking-tight text-[var(--dmoop-text-primary)] mb-2.5 leading-tight">
              Good evening, <span style={{
                background: "var(--dmoop-gradient-accent)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 500,
              }}>Amit</span>
            </h1>
            <p className="text-[14.5px] text-[var(--dmoop-text-secondary)] font-normal">
              What marketing challenge can DMOOP help you solve today?
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s.title}
              onClick={() => startWith(s.prompt)}
              style={{ animationDelay: `${100 + i * 60}ms` }}
              className="group relative text-left p-4 rounded-2xl bg-[var(--dmoop-gradient-card)] border border-[var(--dmoop-border-soft)] overflow-hidden dmoop-card dmoop-stagger-in"
            >
              <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${s.accent} opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500`} />

              <div className="relative">
                <div className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center mb-2.5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                  style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
                  <s.icon size={16} className={s.iconColor} strokeWidth={2.2} />
                </div>
                <p className="text-[13.5px] font-semibold text-[var(--dmoop-text-primary)] mb-1 tracking-tight">
                  {s.title}
                </p>
                <p className="text-[12px] text-[var(--dmoop-text-secondary)] line-clamp-2 leading-relaxed">
                  {s.prompt}
                </p>
              </div>
            </button>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
