"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/lib/chat-store";
import { MODELS, getModel } from "@/lib/models";
import { Check, ChevronDown, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ModelSelector() {
  const { selectedModel, setModel } = useChatStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getModel(selectedModel);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-all duration-200",
          open
            ? "bg-[#f5f1ea] text-[var(--dmoop-text-primary)]"
            : "text-[var(--dmoop-text-secondary)] hover:bg-[#f5f1ea] hover:text-[var(--dmoop-text-primary)]"
        )}
      >
        <Sparkles size={13} className={current.color} strokeWidth={2.2} />
        <span className="font-semibold tracking-tight">{current.name}</span>
        <ChevronDown
          size={12}
          className={cn(
            "opacity-50 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 w-[380px] rounded-2xl overflow-hidden z-50 dmoop-scale-in"
          style={{
            background: "var(--dmoop-gradient-card)",
            border: "1px solid var(--dmoop-border-soft)",
            boxShadow: "var(--dmoop-shadow-xl)",
          }}
        >
          <div className="px-4 pt-3.5 pb-2 border-b border-[var(--dmoop-border-soft)]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[var(--dmoop-text-tertiary)] uppercase tracking-wider">
                Choose a model
              </p>
              <Zap size={11} className="text-[var(--dmoop-text-tertiary)]" />
            </div>
          </div>
          <div className="py-1.5">
            {MODELS.map((m, i) => {
              const active = selectedModel === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setModel(m.id);
                    setOpen(false);
                  }}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={cn(
                    "group relative w-full px-4 py-3 transition-all duration-150 flex items-start gap-3 text-left dmoop-stagger-in",
                    active ? "bg-[#f9f5ee]" : "hover:bg-[#faf6ef]"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--dmoop-accent)]" />
                  )}
                  <div
                    className={cn(
                      "w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br flex items-center justify-center transition-transform duration-200 group-hover:scale-110",
                      m.glow
                    )}
                    style={{ boxShadow: "var(--dmoop-shadow-xs)" }}
                  >
                    <Sparkles size={14} className={m.color} strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13.5px] font-semibold text-[var(--dmoop-text-primary)] tracking-tight">
                        {m.label}
                      </span>
                      {m.badge && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wide uppercase"
                          style={{
                            background: "rgba(193, 74, 42, 0.1)",
                            color: "var(--dmoop-accent)",
                          }}
                        >
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[var(--dmoop-text-secondary)] leading-relaxed mb-1.5">
                      {m.description}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[var(--dmoop-text-tertiary)]" />
                      <span className="text-[10.5px] text-[var(--dmoop-text-tertiary)] font-medium tracking-wide">
                        {m.speed}
                      </span>
                    </div>
                  </div>
                  {active && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: "var(--dmoop-gradient-accent)",
                        boxShadow: "var(--dmoop-shadow-xs)",
                      }}
                    >
                      <Check size={12} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-4 py-2.5 border-t border-[var(--dmoop-border-soft)] bg-[#fbf8f4]">
            <p className="text-[10.5px] text-[var(--dmoop-text-tertiary)] tracking-wide">
              All models powered by retrieval-augmented learning from your feedback.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
