"use client";

import { useChatStore } from "@/lib/chat-store";
import { streamChat } from "@/lib/stream-chat";
import { TrendingUp, Wand2, Mail, Target, Mic2, Crosshair } from "lucide-react";

const SUGGESTIONS = [
  {
    icon: Wand2,
    color: "text-violet-600 bg-violet-50",
    title: "Generate ad copy",
    prompt: "Write 3 Google Ads variants for a B2B SaaS marketing platform targeting growth marketers.",
  },
  {
    icon: TrendingUp,
    color: "text-blue-600 bg-blue-50",
    title: "Show me trending topics",
    prompt: "What are the top marketing trends I should know about this week?",
  },
  {
    icon: Mail,
    color: "text-emerald-600 bg-emerald-50",
    title: "Write an email sequence",
    prompt: "Draft a 5-email product launch sequence for a marketing automation tool.",
  },
  {
    icon: Target,
    color: "text-amber-600 bg-amber-50",
    title: "Build a GTM strategy",
    prompt: "Help me build a 90-day go-to-market strategy for launching into the mid-market segment.",
  },
  {
    icon: Mic2,
    color: "text-pink-600 bg-pink-50",
    title: "Score copy against my brand",
    prompt: "Score this copy against my brand voice: 'The world-class, guaranteed cheapest solution your team will love.'",
  },
  {
    icon: Crosshair,
    color: "text-rose-600 bg-rose-50",
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
      const final = await streamChat({
        messages: [{ id: "u", role: "user", content: prompt, createdAt: new Date() }],
        model: selectedModel,
        onToken: (acc) => updateMessage(id, asstId, { content: acc }),
      });
      updateMessage(id, asstId, { content: final, isStreaming: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateMessage(id, asstId, { content: `⚠️ ${msg}`, isStreaming: false });
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif text-[#c96442] mb-3">
            <span className="italic">✻</span> Good evening, Amit
          </h1>
          <p className="text-[15px] text-[#5a5a5a]">
            What marketing challenge can I help you crack today?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              onClick={() => startWith(s.prompt)}
              className="text-left p-4 rounded-2xl bg-white border border-[#e5e5e5] hover:border-[#c96442] hover:shadow-sm transition-all group"
            >
              <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center mb-2.5`}>
                <s.icon size={15} />
              </div>
              <p className="text-sm font-medium text-[#1a1a1a] mb-1">{s.title}</p>
              <p className="text-[12px] text-[#777] line-clamp-2 leading-relaxed">{s.prompt}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
