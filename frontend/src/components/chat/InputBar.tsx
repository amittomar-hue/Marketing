"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useChatStore } from "@/lib/chat-store";
import { streamChat } from "@/lib/stream-chat";
import Link from "next/link";
import ModelSelector from "./ModelSelector";
import BrandAgent from "./BrandAgent";
import { useBrandAgentName } from "@/lib/brand-agent-name";
import { Paperclip, ArrowUp, Globe, Hammer, X, FileText, Mic, MicOff, BookOpen, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Web Speech API types (minimal shim — TypeScript doesn't ship them globally)
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const TOOL_PRESETS = [
  { label: "SEO audit", prompt: "Audit my landing page for SEO and give me a prioritized list of 10 specific fixes with expected impact." },
  { label: "Write ad copy", prompt: "Write 3 Google Ads variants for [PRODUCT] targeting [AUDIENCE]." },
  { label: "Email sequence", prompt: "Draft a 5-email product launch sequence for [PRODUCT]." },
  { label: "Competitor teardown", prompt: "Analyze [COMPETITOR] and suggest 3 counter-positioning angles." },
  { label: "Buyer signal analysis", prompt: "Score these leads by buying intent and recommend next actions: [LEADS]" },
  { label: "Brand voice score", prompt: "Score this copy against my brand voice (confident, data-driven): [COPY]" },
  { label: "GTM plan", prompt: "Build a 90-day GTM plan for launching into [MARKET]." },
  { label: "ABM playbook", prompt: "Design an ABM playbook for tier-1 accounts in [INDUSTRY]." },
];

export default function InputBar() {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const {
    activeId, newConversation, addMessage, updateMessage, selectedModel,
    webSearchForced, setWebSearchMode,
    pendingAttachment, setPendingAttachment,
  } = useChatStore();
  const [agentName] = useBrandAgentName();

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 280) + "px";
    }
  }, [value]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const [parsingFile, setParsingFile] = useState(false);

  // ── Voice input via Web Speech API ─────────────────────────────
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Holds the committed, finalized portion of the dictated text
  const baseValueRef = useRef<string>("");
  // Tracks USER INTENT to keep listening (vs the actual API state)
  const wantListeningRef = useRef<boolean>(false);
  // Track recent restart attempts so we don't loop infinitely on real errors
  const restartAttemptsRef = useRef<number>(0);
  const lastSuccessfulSpeechRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    setVoiceSupported(true);

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let finalAddition = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) finalAddition += transcript;
        else interim += transcript;
      }
      if (finalAddition) {
        const trimmed = finalAddition.trim();
        baseValueRef.current = baseValueRef.current
          ? `${baseValueRef.current} ${trimmed}`
          : trimmed;
        lastSuccessfulSpeechRef.current = Date.now();
        restartAttemptsRef.current = 0; // reset on any real speech
      }
      const combined = interim
        ? `${baseValueRef.current} ${interim.trim()}`.trim()
        : baseValueRef.current;
      setValue(combined);
    };

    // Auto-restart on end (browser stops after pauses; we want continuous)
    recognition.onend = () => {
      if (!wantListeningRef.current) {
        setListening(false);
        return;
      }
      // If we ended super fast with no speech captured, back off — avoid loop on errors
      const elapsed = Date.now() - (lastSuccessfulSpeechRef.current || 0);
      if (restartAttemptsRef.current >= 6 && elapsed > 30_000) {
        // 6 consecutive restarts with no successful speech → give up
        wantListeningRef.current = false;
        setListening(false);
        return;
      }
      restartAttemptsRef.current += 1;
      try {
        recognition.start();
      } catch {
        // Already started or otherwise — schedule a slight delay restart
        setTimeout(() => {
          if (!wantListeningRef.current) return;
          try { recognition.start(); } catch {}
        }, 250);
      }
    };

    recognition.onerror = (e) => {
      // "no-speech" and "aborted" are normal during pauses — let onend handle restart
      if (e.error === "no-speech" || e.error === "aborted") return;
      // "not-allowed" / "audio-capture" / "service-not-allowed" → mic blocked
      if (e.error === "not-allowed" || e.error === "audio-capture" || e.error === "service-not-allowed") {
        wantListeningRef.current = false;
        setListening(false);
        alert(`Microphone error: ${e.error}. Allow microphone access in your browser settings.`);
        return;
      }
      // Other errors — log but let onend's auto-restart try again
      console.warn("speech recognition error:", e.error);
    };

    recognitionRef.current = recognition;
    return () => {
      wantListeningRef.current = false;
      try { recognition.stop(); } catch {}
    };
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      wantListeningRef.current = false;
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
    } else {
      baseValueRef.current = value.trim();
      restartAttemptsRef.current = 0;
      lastSuccessfulSpeechRef.current = Date.now();
      wantListeningRef.current = true;
      try {
        recognitionRef.current.start();
        setListening(true);
        setTimeout(() => taRef.current?.focus(), 50);
      } catch {
        wantListeningRef.current = false;
        setListening(false);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large. Max 10MB.");
      return;
    }
    setParsingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-document", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to parse document");
        return;
      }
      setPendingAttachment({
        name: file.name,
        content: data.text ?? "",
      });
    } catch (err) {
      alert("Upload failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const send = async () => {
    const text = value.trim();
    if (!text && !pendingAttachment) return;

    // Stop any in-progress voice recognition
    if (listening && recognitionRef.current) {
      wantListeningRef.current = false;
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
    }
    baseValueRef.current = "";
    restartAttemptsRef.current = 0;

    let convId = activeId;
    if (!convId) convId = newConversation();

    // Compose the user message — include attachment as a prefix if present
    const userContent = pendingAttachment
      ? `[Attached: ${pendingAttachment.name}]\n${pendingAttachment.content}\n\n---\n\n${text}`
      : text;

    addMessage(convId, {
      role: "user",
      content: userContent,
      attachmentName: pendingAttachment?.name,
    });
    setValue("");
    const attachmentForThisMessage = pendingAttachment;
    setPendingAttachment(null);

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
        webSearchMode: webSearchForced,
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
    void attachmentForThisMessage;
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasValue = value.trim().length > 0 || pendingAttachment !== null;

  const cycleWebSearch = () => {
    setWebSearchMode(
      webSearchForced === "auto" ? "on" :
      webSearchForced === "on" ? "off" : "auto"
    );
  };

  const insertToolPrompt = (prompt: string) => {
    setValue((v) => (v ? v + "\n\n" + prompt : prompt));
    setToolsOpen(false);
    setTimeout(() => taRef.current?.focus(), 50);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 pb-3 pt-1">
      {/* Pending attachment chip */}
      {pendingAttachment && (
        <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[var(--dmoop-border-soft)] shadow-[var(--dmoop-shadow-xs)] text-[12.5px]">
          <FileText size={12} className="text-[var(--dmoop-accent)] shrink-0" />
          <span className="font-medium text-[var(--dmoop-text-primary)] truncate flex-1">
            {pendingAttachment.name}
          </span>
          <span className="text-[10.5px] text-[var(--dmoop-text-tertiary)]">
            {(pendingAttachment.content.length / 1024).toFixed(1)}KB
          </span>
          <button onClick={() => setPendingAttachment(null)}
            className="p-0.5 rounded-md hover:bg-[#f0ede8] transition-colors">
            <X size={12} className="text-[var(--dmoop-text-secondary)]" />
          </button>
        </div>
      )}

      <div
        className={`relative rounded-[20px] sm:rounded-[24px] transition-all duration-300 ease-out dmoop-input-elev ${
          isFocused ? "scale-[1.005]" : ""
        }`}
      >
        <div
          className="absolute inset-x-0 top-0 h-px rounded-t-[20px] sm:rounded-t-[24px] pointer-events-none"
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

        <div className="flex items-center justify-between px-2 sm:px-3 pb-3 pt-1.5 gap-1.5 sm:gap-2">
          <div className="flex items-center gap-0.5 sm:gap-1 min-w-0 flex-1">
            {/* Attach */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.xls,.pptx,.txt,.md,.csv,.tsv,.json,.log,.html,.htm,.xml,.yml,.yaml,.rtf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingFile}
              className={cn(
                "p-1.5 sm:p-2 rounded-lg text-[var(--dmoop-text-secondary)] transition-all duration-150 hover:bg-[#f5f1ea] hover:text-[var(--dmoop-text-primary)] active:scale-95 shrink-0",
                pendingAttachment && "text-[var(--dmoop-accent)] bg-[#fbf3ee]",
                parsingFile && "opacity-60 cursor-wait"
              )}
              title="Attach PDF, Word, Excel, PowerPoint, or text (max 10MB)"
            >
              {parsingFile ? (
                <span className="block w-3.5 h-3.5 border-2 border-[var(--dmoop-accent)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Paperclip size={14} strokeWidth={2} />
              )}
            </button>

            {/* Search toggle */}
            <button
              type="button"
              onClick={cycleWebSearch}
              className={cn(
                "flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[13px] transition-all duration-150 active:scale-95",
                webSearchForced === "on"
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                  : webSearchForced === "off"
                  ? "bg-gray-50 text-gray-500 ring-1 ring-gray-200"
                  : "text-[var(--dmoop-text-secondary)] hover:bg-[#f5f1ea] hover:text-[var(--dmoop-text-primary)]"
              )}
              title={
                webSearchForced === "auto" ? "Search: Auto (smart)" :
                webSearchForced === "on" ? "Search: Always on" :
                "Search: Off (no web)"
              }
            >
              <Globe size={13} strokeWidth={2} />
              <span className="font-medium hidden sm:inline">
                Search{webSearchForced === "on" ? " · On" : webSearchForced === "off" ? " · Off" : ""}
              </span>
            </button>

            {/* Brand Agent — assets grounded in user's uploaded docs */}
            <BrandAgent onInsert={(prompt) => {
              setValue((v) => (v ? v + "\n\n" + prompt : prompt));
              setTimeout(() => taRef.current?.focus(), 50);
            }} />

            {/* Tools picker */}
            <div ref={toolsRef} className="relative">
              <button
                type="button"
                onClick={() => setToolsOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[13px] transition-all duration-150 active:scale-95",
                  toolsOpen
                    ? "bg-[#f5f1ea] text-[var(--dmoop-text-primary)]"
                    : "text-[var(--dmoop-text-secondary)] hover:bg-[#f5f1ea] hover:text-[var(--dmoop-text-primary)]"
                )}
                title="Quick capability picker"
              >
                <Hammer size={13} strokeWidth={2} />
                <span className="font-medium hidden sm:inline">Tools</span>
              </button>

              {toolsOpen && (
                <div
                  className="absolute bottom-full left-0 mb-2 w-[280px] max-w-[calc(100vw-1.5rem)] rounded-xl overflow-hidden z-50 dmoop-scale-in"
                  style={{
                    background: "var(--dmoop-gradient-card)",
                    border: "1px solid var(--dmoop-border-soft)",
                    boxShadow: "var(--dmoop-shadow-xl)",
                  }}
                >
                  {/* Brand agent quick-link at the top of Tools */}
                  <Link
                    href="/brand"
                    onClick={() => setToolsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#fbf3ee] transition-colors border-b border-[var(--dmoop-border-soft)]"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#fbf3ee] flex items-center justify-center shrink-0">
                      <BookOpen size={13} className="text-[var(--dmoop-accent)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-[var(--dmoop-text-primary)] truncate">
                        {agentName}
                      </p>
                      <p className="text-[10.5px] text-[var(--dmoop-text-secondary)] truncate">
                        Generate assets from your brand library
                      </p>
                    </div>
                    <ChevronRight size={12} className="text-[var(--dmoop-text-tertiary)] shrink-0" />
                  </Link>

                  <div className="px-3 pt-2.5 pb-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)]">
                      Quick prompts
                    </p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto dmoop-scroll">
                    {TOOL_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => insertToolPrompt(p.prompt)}
                        className="w-full text-left px-3 py-2 hover:bg-[#f5f1ea] transition-colors text-[12.5px] text-[var(--dmoop-text-primary)] font-medium"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ModelSelector />

            {/* Voice — sits just before the submit button on the right */}
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoice}
                className={cn(
                  "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95",
                  listening
                    ? "text-white bg-red-500 hover:bg-red-600 shadow-[0_2px_8px_rgba(239,68,68,0.35)]"
                    : "text-[var(--dmoop-text-secondary)] bg-[#f5f1ea]/60 hover:bg-[#f5f1ea] hover:text-[var(--dmoop-text-primary)]"
                )}
                title={listening ? "Stop voice input" : "Voice input"}
              >
                {listening && (
                  <span className="absolute inset-0 rounded-xl bg-red-500/40 animate-ping" />
                )}
                {listening ? <MicOff size={15} strokeWidth={2.2} className="relative" /> : <Mic size={15} strokeWidth={2.2} />}
              </button>
            )}

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
