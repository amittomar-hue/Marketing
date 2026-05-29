"use client";

import { useState } from "react";
import { Message as MessageType, useChatStore } from "@/lib/chat-store";
import { getModel } from "@/lib/models";
import { submitFeedback } from "@/lib/stream-chat";
import { Copy, ThumbsUp, ThumbsDown, RotateCcw, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";

function formatContent(content: string) {
  const lines = content.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j} className="font-semibold text-[var(--dmoop-text-primary)]">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={j}>{part}</span>
          )
        )}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

export default function Message({ message }: { message: MessageType }) {
  const updateMessage = useChatStore((s) => s.updateMessage);
  const activeId = useChatStore((s) => s.activeId);
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end dmoop-fade-in">
        <div
          className="max-w-[80%] rounded-[20px] px-5 py-3 text-[15px] text-[var(--dmoop-text-primary)] whitespace-pre-wrap leading-relaxed"
          style={{
            background: "linear-gradient(135deg, #f3eee6 0%, #ebe5da 100%)",
            border: "1px solid rgba(165, 138, 110, 0.15)",
            boxShadow: "var(--dmoop-shadow-sm)",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const model = message.model ? getModel(message.model) : null;

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const rate = async (rating: 1 | -1) => {
    if (!message.interactionId || !activeId) return;
    if (message.userRating === rating) return;
    updateMessage(activeId, message.id, { userRating: rating });
    try {
      await submitFeedback(message.interactionId, rating);
    } catch (err) {
      console.error("feedback failed:", err);
    }
  };

  return (
    <div className="flex gap-3 dmoop-fade-in">
      <div
        className="relative w-9 h-9 shrink-0 rounded-xl flex items-center justify-center mt-0.5"
        style={{
          background: "var(--dmoop-gradient-accent)",
          boxShadow: "var(--dmoop-shadow-accent)",
        }}
      >
        <Sparkles size={14} className="text-white drop-shadow-sm" />
        <span
          className="absolute inset-0 rounded-xl opacity-40 pointer-events-none"
          style={{ background: "var(--dmoop-gradient-sheen)" }}
        />
      </div>

      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[13px] font-semibold tracking-tight text-[var(--dmoop-text-primary)]">
            DMOOP
          </span>
          {model && (
            <span className={`text-[11px] font-medium ${model.color} flex items-center gap-1`}>
              <span className="w-1 h-1 rounded-full bg-current" />
              {model.name}
            </span>
          )}
          {message.isStreaming && (
            <span className="flex gap-1 ml-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--dmoop-accent)] animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--dmoop-accent)] animate-pulse [animation-delay:200ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--dmoop-accent)] animate-pulse [animation-delay:400ms]" />
            </span>
          )}
        </div>

        <div className="text-[15px] text-[var(--dmoop-text-primary)] leading-[1.7] whitespace-pre-wrap">
          {formatContent(message.content)}
          {message.isStreaming && message.content && (
            <span className="inline-block w-[2px] h-4 bg-[var(--dmoop-accent)] ml-0.5 animate-pulse align-middle rounded-sm" />
          )}
        </div>

        {!message.isStreaming && message.content && (
          <div className="flex items-center gap-0.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ActionButton onClick={copy} title="Copy" active={copied}>
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            </ActionButton>
            <ActionButton
              onClick={() => rate(1)}
              title="Good response — saves as a learning example"
              active={message.userRating === 1}
              activeColor="text-emerald-600 bg-emerald-50"
              disabled={!message.interactionId}
            >
              <ThumbsUp size={13} />
            </ActionButton>
            <ActionButton
              onClick={() => rate(-1)}
              title="Bad response — won't be used as a future example"
              active={message.userRating === -1}
              activeColor="text-red-500 bg-red-50"
              disabled={!message.interactionId}
            >
              <ThumbsDown size={13} />
            </ActionButton>
            <ActionButton title="Regenerate">
              <RotateCcw size={13} />
            </ActionButton>
            {message.interactionId && (
              <span className="ml-2 text-[10px] text-[var(--dmoop-text-tertiary)] font-mono tracking-tight">
                {message.interactionId.slice(0, 8)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  title,
  active = false,
  activeColor = "",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
  active?: boolean;
  activeColor?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-1.5 rounded-lg transition-all duration-150 active:scale-90",
        active && activeColor ? activeColor : "text-[var(--dmoop-text-secondary)] hover:bg-[#f5f1ea]",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}
