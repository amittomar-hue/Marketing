"use client";

import { useState } from "react";
import { Message as MessageType, useChatStore } from "@/lib/chat-store";
import { getModel } from "@/lib/models";
import { submitFeedback, streamChat } from "@/lib/stream-chat";
import { downloadAs, FORMAT_LABELS, type ExportFormat } from "@/lib/export";
import Image from "next/image";
import { Copy, ThumbsUp, ThumbsDown, RotateCcw, Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import Markdown from "./Markdown";

export default function Message({ message }: { message: MessageType }) {
  const updateMessage = useChatStore((s) => s.updateMessage);
  const activeId = useChatStore((s) => s.activeId);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const webSearchForced = useChatStore((s) => s.webSearchForced);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end dmoop-fade-in">
        <div
          className="max-w-[90%] sm:max-w-[80%] rounded-[20px] px-4 sm:px-5 py-2.5 sm:py-3 text-[14px] sm:text-[15px] text-[var(--dmoop-text-primary)] whitespace-pre-wrap leading-relaxed break-words"
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

  const regenerate = async () => {
    if (!activeId || regenerating || message.isStreaming) return;
    const state = useChatStore.getState();
    const conv = state.conversations.find((c) => c.id === activeId);
    if (!conv) return;

    // Build the history UP TO (but not including) this assistant message
    const idx = conv.messages.findIndex((m) => m.id === message.id);
    if (idx < 1) return; // need at least one prior message (the user prompt)
    const history = conv.messages.slice(0, idx);

    setRegenerating(true);
    // Reset the current assistant message
    updateMessage(activeId, message.id, {
      content: "",
      isStreaming: true,
      interactionId: undefined,
      userRating: null,
      model: selectedModel,
    });

    try {
      const { text, interactionId } = await streamChat({
        messages: history,
        model: selectedModel,
        webSearchMode: webSearchForced,
        onToken: (acc) => updateMessage(activeId, message.id, { content: acc }),
      });
      updateMessage(activeId, message.id, {
        content: text,
        isStreaming: false,
        interactionId: interactionId ?? undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateMessage(activeId, message.id, {
        content: `⚠️ ${msg}`,
        isStreaming: false,
      });
    } finally {
      setRegenerating(false);
    }
  };

  const download = async () => {
    if (!message.requestedFormat || downloading) return;
    setDownloading(true);
    try {
      await downloadAs(
        message.requestedFormat as ExportFormat,
        message.content,
        message.formatPromptHint ?? message.content.slice(0, 40)
      );
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 1800);
    } catch (err) {
      console.error("download failed:", err);
    } finally {
      setDownloading(false);
    }
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
    <div className="flex gap-2.5 sm:gap-3 dmoop-fade-in">
      <div
        className="relative w-9 h-9 shrink-0 rounded-xl flex items-center justify-center mt-0.5 bg-white p-1.5 overflow-hidden"
        style={{
          border: "1px solid var(--dmoop-border-soft)",
          boxShadow: "var(--dmoop-shadow-sm)",
        }}
      >
        <Image
          src="/dmoop-logo.png"
          alt="DMOOP"
          width={64}
          height={20}
          priority
          className="w-full h-auto object-contain"
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

        <div className="text-[14px] sm:text-[15px] text-[var(--dmoop-text-primary)] break-words">
          <Markdown content={message.content} />
          {message.isStreaming && message.content && (
            <span className="inline-block w-[2px] h-4 bg-[var(--dmoop-accent)] ml-0.5 animate-pulse align-middle rounded-sm" />
          )}
        </div>

        {/* Prominent Download CTA: visible when the user explicitly asked for a file format */}
        {!message.isStreaming && message.content && message.requestedFormat && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={download}
              disabled={downloading}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12.5px] font-semibold transition-all duration-200 active:scale-[0.97]",
                downloaded
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "dmoop-btn-primary"
              )}
              title={`Download as ${FORMAT_LABELS[message.requestedFormat as ExportFormat] ?? message.requestedFormat}`}
            >
              {downloaded ? (
                <>
                  <Check size={13} /> Downloaded
                </>
              ) : downloading ? (
                <>
                  <Download size={13} className="animate-pulse" /> Preparing…
                </>
              ) : (
                <>
                  <Download size={13} />
                  Download as {FORMAT_LABELS[message.requestedFormat as ExportFormat] ?? message.requestedFormat.toUpperCase()}
                </>
              )}
            </button>
            <span className="text-[11px] text-[var(--dmoop-text-tertiary)]">
              Generated locally · nothing leaves your browser
            </span>
          </div>
        )}

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
            <ActionButton
              onClick={regenerate}
              title="Regenerate response"
              disabled={regenerating || message.isStreaming}
            >
              <RotateCcw size={13} className={regenerating ? "animate-spin" : ""} />
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
