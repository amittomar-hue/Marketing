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
            <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
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
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-3xl bg-[#f0ede8] px-5 py-3 text-[15px] text-[#1a1a1a] whitespace-pre-wrap">
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
    if (message.userRating === rating) return; // already set
    updateMessage(activeId, message.id, { userRating: rating });
    try {
      await submitFeedback(message.interactionId, rating);
    } catch (err) {
      console.error("feedback failed:", err);
    }
  };

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 shrink-0 rounded-full bg-[#c96442] flex items-center justify-center mt-1">
        <Sparkles size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-medium text-[#1a1a1a]">Marketing LLM</span>
          {model && (
            <span className={`text-[11px] font-medium ${model.color}`}>{model.name}</span>
          )}
          {message.isStreaming && (
            <span className="flex gap-1 ml-1">
              <span className="w-1 h-1 rounded-full bg-[#c96442] animate-pulse" />
              <span className="w-1 h-1 rounded-full bg-[#c96442] animate-pulse [animation-delay:200ms]" />
              <span className="w-1 h-1 rounded-full bg-[#c96442] animate-pulse [animation-delay:400ms]" />
            </span>
          )}
        </div>
        <div className="text-[15px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
          {formatContent(message.content)}
          {message.isStreaming && message.content && (
            <span className="inline-block w-1.5 h-4 bg-[#c96442] ml-0.5 animate-pulse align-middle" />
          )}
        </div>
        {!message.isStreaming && message.content && (
          <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={copy}
              className="p-1.5 rounded-md hover:bg-[#f0f0f0] text-[#5a5a5a]"
              title="Copy"
            >
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            </button>
            <button
              onClick={() => rate(1)}
              className={cn(
                "p-1.5 rounded-md hover:bg-[#f0f0f0] transition-colors",
                message.userRating === 1 ? "text-emerald-600 bg-emerald-50" : "text-[#5a5a5a]"
              )}
              title="Good response — saves as a learning example"
              disabled={!message.interactionId}
            >
              <ThumbsUp size={13} />
            </button>
            <button
              onClick={() => rate(-1)}
              className={cn(
                "p-1.5 rounded-md hover:bg-[#f0f0f0] transition-colors",
                message.userRating === -1 ? "text-red-500 bg-red-50" : "text-[#5a5a5a]"
              )}
              title="Bad response — won't be used as a future example"
              disabled={!message.interactionId}
            >
              <ThumbsDown size={13} />
            </button>
            <button
              className="p-1.5 rounded-md hover:bg-[#f0f0f0] text-[#5a5a5a]"
              title="Regenerate"
            >
              <RotateCcw size={13} />
            </button>
            {message.interactionId && (
              <span className="ml-2 text-[10px] text-[#999]">
                ID {message.interactionId.slice(0, 8)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
