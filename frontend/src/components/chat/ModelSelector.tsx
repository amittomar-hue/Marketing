"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/lib/chat-store";
import { MODELS, getModel } from "@/lib/models";
import { Check, ChevronDown, Sparkles } from "lucide-react";
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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#f0f0f0] transition-colors text-sm text-[#3d3d3d]"
      >
        <Sparkles size={13} className={current.color} />
        <span className="font-medium">{current.name}</span>
        <ChevronDown size={13} className={cn("opacity-50 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-[340px] rounded-xl bg-white border border-[#e5e5e5] shadow-lg overflow-hidden z-50">
          <div className="px-3 pt-3 pb-2">
            <p className="text-[11px] font-medium text-[#8a8a8a] uppercase tracking-wider">
              Choose a model
            </p>
          </div>
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setModel(m.id);
                setOpen(false);
              }}
              className="w-full px-3 py-2.5 hover:bg-[#f5f5f5] transition-colors flex items-start gap-3 text-left"
            >
              <Sparkles size={14} className={cn("mt-0.5 shrink-0", m.color)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-[#1a1a1a]">{m.label}</span>
                  {m.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#fef3e6] text-[#c96442] font-medium">
                      {m.badge}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[#666] leading-relaxed">{m.description}</p>
                <p className="text-[11px] text-[#999] mt-1">Speed: {m.speed}</p>
              </div>
              {selectedModel === m.id && (
                <Check size={14} className="text-[#c96442] mt-1 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
