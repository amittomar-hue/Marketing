"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useChatStore } from "@/lib/chat-store";
import { streamChat } from "@/lib/stream-chat";
import ModelSelector from "./ModelSelector";
import { Paperclip, ArrowUp, Globe, Hammer } from "lucide-react";

export default function InputBar() {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { activeId, newConversation, addMessage, updateMessage, selectedModel } = useChatStore();

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 280) + "px";
    }
  }, [value]);

  const send = async () => {
    const text = value.trim();
    if (!text) return;

    let convId = activeId;
    if (!convId) convId = newConversation();

    addMessage(convId, { role: "user", content: text });
    setValue("");

    const asstId = addMessage(convId, {
      role: "assistant",
      content: "",
      model: selectedModel,
      isStreaming: true,
    });

    try {
      const conv = useChatStore.getState().conversations.find((c) => c.id === convId);
      const history = conv?.messages.filter((m) => m.id !== asstId) ?? [];
      const { text: final, interactionId } = await streamChat({
        messages: history,
        model: selectedModel,
        onToken: (acc) => updateMessage(convId!, asstId, { content: acc }),
      });
      updateMessage(convId, asstId, {
        content: final,
        isStreaming: false,
        interactionId: interactionId ?? undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateMessage(convId, asstId, {
        content: `⚠️ ${msg}`,
        isStreaming: false,
      });
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasValue = value.trim().length > 0;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-3 pt-1">
      <div
        className={`relative rounded-[24px] transition-all duration-300 ease-out dmoop-input-elev ${
          isFocused ? "scale-[1.005]" : ""
        }`}
      >
        {/* Subtle top sheen */}
        <div
          className="absolute inset-x-0 top-0 h-px rounded-t-[28px] pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent 10%, rgba(193,74,42,0.25) 50%, transparent 90%)",
          }}
        />

        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="How can DMOOP help you today?"
          className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] text-[var(--dmoop-text-primary)] placeholder:text-[var(--dmoop-text-tertiary)] focus:outline-none leading-relaxed"
        />

        <div className="flex items-center justify-between px-3 pb-3 pt-1.5">
          <div className="flex items-center gap-1">
            <ToolButton icon={Paperclip} label="Attach" />
            <ToolButton icon={Globe} label="Search" hasText />
            <ToolButton icon={Hammer} label="Tools" hasText />
          </div>
          <div className="flex items-center gap-2.5">
            <ModelSelector />
            <button
              onClick={send}
              disabled={!hasValue}
              className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 overflow-hidden ${
                hasValue ? "dmoop-btn-primary" : "bg-[#e8e2d8] text-[#b8ad9f] cursor-not-allowed"
              }`}
            >
              {hasValue && (
                <span
                  className="absolute inset-0 opacity-50"
                  style={{ background: "var(--dmoop-gradient-sheen)" }}
                />
              )}
              <ArrowUp size={16} strokeWidth={2.5} className="relative" />
            </button>
          </div>
        </div>
      </div>
      <p className="text-center text-[10.5px] text-[var(--dmoop-text-tertiary)] mt-2 tracking-wide">
        DMOOP generates AI-assisted content. Verify against your brand guidelines before publishing.
      </p>
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  hasText = false,
}: {
  icon: React.ComponentType<{ size: number; strokeWidth?: number }>;
  label: string;
  hasText?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1.5 ${hasText ? "px-2.5" : "px-2"} py-1.5 rounded-lg text-[13px] text-[var(--dmoop-text-secondary)] transition-all duration-150 hover:bg-[#f5f1ea] hover:text-[var(--dmoop-text-primary)] active:scale-95`}
      title={label}
    >
      <Icon size={14} strokeWidth={2} />
      {hasText && <span className="font-medium">{label}</span>}
    </button>
  );
}
