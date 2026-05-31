"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Sparkles, Globe, Paperclip, Hammer, ThumbsUp, Radar,
  Shield, ArrowRight, ArrowLeft, X, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "dmoop_onboarded_v1";

interface Step {
  icon: React.ComponentType<{ size: number; className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  body: React.ReactNode;
  accent: string;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to DMOOP",
    subtitle: "Enterprise marketing intelligence, fine-tuned for you",
    accent: "from-violet-500 to-fuchsia-500",
    body: (
      <>
        <p>
          DMOOP handles the full surface of modern marketing — SEO, ABM, ad copy, email,
          GTM strategy, ORM, buyer signals, competitive intelligence, and much more.
        </p>
        <p>
          Every response is grounded in <strong>live web research</strong> and a corpus of
          marketing articles scraped fresh every day.
        </p>
      </>
    ),
  },
  {
    icon: Sparkles,
    title: "Four models, one purpose",
    subtitle: "Pick the model that fits the task",
    accent: "from-blue-500 to-cyan-500",
    body: (
      <ul className="flex flex-col gap-1.5">
        <li><strong className="text-violet-700">Apex</strong> — flagship intelligence for executive strategy, deep analysis</li>
        <li><strong className="text-[var(--dmoop-accent)]">Core</strong> — balanced workhorse, best for daily campaigns (default)</li>
        <li><strong className="text-emerald-700">Pulse</strong> — sub-second responses for quick ad copy & subject lines</li>
        <li><strong className="text-amber-700">Tuned</strong> — self-learning model that leans on your team&apos;s thumbs-ups</li>
      </ul>
    ),
  },
  {
    icon: Hammer,
    title: "Tools at your fingertips",
    subtitle: "Three controls below the chat box",
    accent: "from-emerald-500 to-teal-500",
    body: (
      <ul className="flex flex-col gap-2.5">
        <li className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-[#fbf3ee] flex items-center justify-center"><Paperclip size={13} className="text-[var(--dmoop-accent)]" /></span>
          <span><strong>Attach</strong> — drop in a PDF, Word doc, Excel, PowerPoint, or text file (up to 10MB). DMOOP parses and uses it as context.</span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Globe size={13} className="text-blue-600" /></span>
          <span><strong>Search</strong> — cycle Auto / On / Off to force live web search for citation-backed answers.</span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-[#f5f1ea] flex items-center justify-center"><Hammer size={13} className="text-[var(--dmoop-text-secondary)]" /></span>
          <span><strong>Tools</strong> — 8 quick prompt presets for common marketing tasks (SEO audit, ABM playbook, etc).</span>
        </li>
      </ul>
    ),
  },
  {
    icon: ThumbsUp,
    title: "It learns from you",
    subtitle: "Every thumbs-up sharpens future responses",
    accent: "from-pink-500 to-rose-500",
    body: (
      <>
        <p>
          When DMOOP gives a response you like, hover over it and click{" "}
          <ThumbsUp size={13} className="inline text-emerald-600 mb-0.5" />. That response
          becomes a learning example automatically retrieved on similar future queries.
        </p>
        <p>
          Over time, DMOOP gets sharper on your brand voice, your preferred frameworks, and the
          kind of answers your team actually ships.
        </p>
      </>
    ),
  },
  {
    icon: Radar,
    title: "Live data, every day",
    subtitle: "60 marketing topics scraped daily, auto-cited",
    accent: "from-amber-500 to-orange-500",
    body: (
      <>
        <p>
          DMOOP scrapes 60 marketing topics every day across SEO, ABM, ORM, buyer signals,
          ad tactics, demand gen, and more. When relevant, responses cite the live sources
          as [1], [2], etc.
        </p>
        <p>
          Just ask <em>&ldquo;what are the latest SEO algorithm updates?&rdquo;</em> or
          <em> &ldquo;summarize this week&rsquo;s AI search news&rdquo;</em> — you&rsquo;ll get
          fresh data, not stale training-cutoff guesses.
        </p>
      </>
    ),
  },
];

export default function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-3 sm:px-4 py-3 sm:py-6 dmoop-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

      <div
        className="relative w-full max-w-lg max-h-[92vh] rounded-2xl flex flex-col overflow-hidden dmoop-scale-in"
        style={{
          background: "var(--dmoop-gradient-card)",
          boxShadow: "var(--dmoop-shadow-xl)",
          border: "1px solid var(--dmoop-border-soft)",
        }}
      >
        {/* Ambient glow tied to step */}
        <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-to-br ${current.accent} opacity-20 blur-3xl pointer-events-none`} />

        {/* Skip button */}
        <button
          onClick={close}
          className="absolute top-3.5 right-3.5 z-10 p-1.5 rounded-lg text-[var(--dmoop-text-secondary)] hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] transition-all"
          aria-label="Skip"
        >
          <X size={15} />
        </button>

        <div className="relative p-5 sm:p-7 pb-5 overflow-y-auto dmoop-scroll flex-1 min-h-0">
          {/* Logo + step counter */}
          <div className="flex items-center justify-between mb-5">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={90} height={28} className="h-6 w-auto" />
            <span className="text-[11px] font-semibold text-[var(--dmoop-text-tertiary)] tracking-wide">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>

          {/* Icon + title */}
          <div className="flex items-start gap-3 mb-3 sm:mb-4">
            <div
              className={`relative shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br ${current.accent} flex items-center justify-center overflow-hidden`}
              style={{ boxShadow: "var(--dmoop-shadow-md)" }}
            >
              {step === 0 ? (
                <span className="absolute inset-1.5 rounded-xl bg-white flex items-center justify-center p-1">
                  <Image src="/dmoop-logo.png" alt="DMOOP" width={72} height={20} className="w-full h-auto object-contain" />
                </span>
              ) : (
                <current.icon size={20} className="text-white" strokeWidth={2.2} />
              )}
            </div>
            <div className="pt-0.5 min-w-0 flex-1">
              <h2 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-tight">
                {current.title}
              </h2>
              <p className="text-[12px] sm:text-[12.5px] text-[var(--dmoop-text-secondary)] mt-0.5">
                {current.subtitle}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="text-[13.5px] text-[var(--dmoop-text-primary)] leading-[1.65] flex flex-col gap-3">
            {current.body}
          </div>
        </div>

        {/* Footer */}
        <div className="relative px-5 sm:px-7 py-3.5 sm:py-4 border-t border-[var(--dmoop-border-soft)] bg-[#fbf8f4] flex items-center justify-between gap-3 shrink-0">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  "transition-all duration-200 rounded-full",
                  i === step
                    ? "w-6 h-1.5 bg-[var(--dmoop-accent)]"
                    : i < step
                    ? "w-1.5 h-1.5 bg-[var(--dmoop-accent)]/40"
                    : "w-1.5 h-1.5 bg-[var(--dmoop-border-soft)]"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-[var(--dmoop-text-secondary)] hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] transition-all"
              >
                <ArrowLeft size={12} /> Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={close}
                className="h-9 px-4 rounded-lg dmoop-btn-primary text-[12.5px] font-semibold flex items-center gap-1.5"
              >
                <CheckCircle2 size={13} /> Get started
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="h-9 px-4 rounded-lg dmoop-btn-primary text-[12.5px] font-semibold flex items-center gap-1.5"
              >
                Next <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResetOnboarding({ onReset }: { onReset?: () => void }) {
  return (
    <button
      onClick={() => {
        localStorage.removeItem(STORAGE_KEY);
        onReset?.();
        window.location.reload();
      }}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-[var(--dmoop-text-secondary)] hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] transition-all w-full text-left"
    >
      <Shield size={13} className="text-[var(--dmoop-text-tertiary)]" />
      <span className="font-medium">Show tour again</span>
    </button>
  );
}
