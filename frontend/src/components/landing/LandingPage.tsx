"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  ArrowRight, Sparkles, Search, Globe, Target, Radar, MessageSquare,
  Layers, BarChart3, Activity, ShieldCheck, Brain, Zap, CheckCircle2,
  TrendingUp, Building2, Crosshair, Mail, Mic2, Wand2,
} from "lucide-react";

const CAPABILITIES = [
  { icon: Wand2, color: "text-violet-600", bg: "bg-violet-50", title: "Ad Copy & Creative", desc: "Google, Meta, LinkedIn, TikTok — variants tuned to your brand" },
  { icon: Mail, color: "text-emerald-600", bg: "bg-emerald-50", title: "Email Sequences", desc: "Launch sequences, nurture flows, cold outreach that converts" },
  { icon: Search, color: "text-blue-600", bg: "bg-blue-50", title: "SEO / AEO / GEO", desc: "Technical audits, AI-search citations, Generative Engine Optimization" },
  { icon: Layers, color: "text-indigo-600", bg: "bg-indigo-50", title: "ABM Playbooks", desc: "Tier-1 account strategies, multi-thread sequences, intent triggers" },
  { icon: Activity, color: "text-rose-600", bg: "bg-rose-50", title: "Buyer Signal Intelligence", desc: "Lead scoring, intent interpretation, propensity models" },
  { icon: Building2, color: "text-slate-700", bg: "bg-slate-100", title: "Company Signals", desc: "Hiring, funding, leadership moves, tech stack tracking" },
  { icon: Target, color: "text-amber-600", bg: "bg-amber-50", title: "GTM Strategy", desc: "Positioning, ICP, channel mix, 90-day launch plans" },
  { icon: Crosshair, color: "text-red-600", bg: "bg-red-50", title: "Competitor Intelligence", desc: "Teardowns, win/loss analysis, counter-positioning angles" },
  { icon: ShieldCheck, color: "text-teal-600", bg: "bg-teal-50", title: "Brand Reputation", desc: "Sentiment monitoring, crisis response, review strategy" },
  { icon: Mic2, color: "text-pink-600", bg: "bg-pink-50", title: "Brand Voice Scoring", desc: "Real-time copy scoring against your guidelines" },
  { icon: BarChart3, color: "text-purple-600", bg: "bg-purple-50", title: "Marketing Analytics", desc: "Attribution, MMM/MTA, channel ROI math" },
  { icon: TrendingUp, color: "text-cyan-600", bg: "bg-cyan-50", title: "Trend Detection", desc: "60+ marketing topics scraped daily with citations" },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Ask anything marketing",
    desc: "From ad variants to ABM playbooks to SEO audits. DMOOP handles the full surface of B2B and B2C marketing.",
    icon: MessageSquare,
  },
  {
    n: "02",
    title: "Real-time data, automatically",
    desc: "Every answer is grounded in live web search (Tavily) + a corpus of marketing articles scraped fresh every day.",
    icon: Globe,
  },
  {
    n: "03",
    title: "Self-learning from your feedback",
    desc: "Thumbs-up on responses you like. DMOOP retrieves them as examples for similar future queries. Your model gets sharper weekly.",
    icon: Brain,
  },
];

const MODELS = [
  {
    name: "Apex",
    badge: "Flagship",
    color: "from-violet-500 to-fuchsia-500",
    desc: "Deep strategy, executive briefs, complex multi-channel analysis",
  },
  {
    name: "Core",
    badge: "Recommended",
    color: "from-[#d8593a] to-[#b03e21]",
    desc: "Balanced workhorse for daily campaigns and trend analysis",
  },
  {
    name: "Pulse",
    badge: "Fast",
    color: "from-emerald-500 to-teal-500",
    desc: "Sub-second responses for quick ad copy and subject lines",
  },
  {
    name: "Tuned",
    badge: "Custom",
    color: "from-amber-500 to-orange-500",
    desc: "Self-learning model that adapts to your brand voice",
  },
];

export default function LandingPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(({ data: { user } }) => setSignedIn(!!user));
  }, []);

  const primaryHref = signedIn ? "/chat" : "/signup";
  const primaryLabel = signedIn ? "Open DMOOP" : "Get started free";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--dmoop-bg-app)" }}>
      {/* ── Navbar ──────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 border-b border-[var(--dmoop-border-soft)] backdrop-blur-xl bg-white/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={130} height={36} priority className="h-8 w-auto" />
            <span className="hidden sm:inline text-[10px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase px-1.5 py-0.5 rounded-md" style={{ background: "rgba(193,74,42,0.08)" }}>
              DMOOP
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link href="#features" className="hidden sm:block px-3 py-2 text-[13px] font-medium text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] transition-colors">
              Features
            </Link>
            <Link href="#how" className="hidden sm:block px-3 py-2 text-[13px] font-medium text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] transition-colors">
              How it works
            </Link>
            <Link href="#models" className="hidden sm:block px-3 py-2 text-[13px] font-medium text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] transition-colors">
              Models
            </Link>
            {signedIn ? (
              <Link href="/chat" className="h-9 px-4 rounded-lg dmoop-btn-primary text-[13px] font-semibold flex items-center gap-1.5">
                Open DMOOP <ArrowRight size={13} />
              </Link>
            ) : (
              <>
                <Link href="/signin" className="px-3 py-2 text-[13px] font-medium text-[var(--dmoop-text-primary)] hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] rounded-lg transition-all">
                  Sign in
                </Link>
                <Link href="/signup" className="h-9 px-4 rounded-lg dmoop-btn-primary text-[13px] font-semibold flex items-center gap-1.5">
                  Get started <ArrowRight size={13} />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Ambient glows */}
        <div
          className="absolute top-0 left-1/4 w-[700px] h-[500px] pointer-events-none opacity-60"
          style={{ background: "radial-gradient(ellipse at top, rgba(193,74,42,0.15) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-20 right-0 w-[500px] h-[500px] pointer-events-none opacity-40"
          style={{ background: "radial-gradient(ellipse at center, rgba(139,92,246,0.12) 0%, transparent 70%)" }}
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-[var(--dmoop-border-soft)] shadow-[var(--dmoop-shadow-xs)] mb-6 dmoop-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-[11px] font-semibold text-[var(--dmoop-text-secondary)] tracking-wide uppercase">
              Live · Self-Learning · Real-Time Intelligence
            </span>
          </div>

          <h1 className="text-[36px] sm:text-[54px] md:text-[64px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-[1.05] mb-5 dmoop-fade-in">
            Marketing intelligence,
            <br />
            <span style={{
              background: "var(--dmoop-gradient-accent)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              fine-tuned for your brand.
            </span>
          </h1>

          <p className="text-[16px] sm:text-[18px] text-[var(--dmoop-text-secondary)] max-w-2xl mx-auto leading-relaxed mb-8 dmoop-fade-in">
            DMOOP is the enterprise-grade AI for the full marketing surface — SEO, ABM, buyer signals, ad copy, GTM strategy. Self-learning from your team&apos;s feedback. Grounded in live web data, every day.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 dmoop-fade-in">
            <Link
              href={primaryHref}
              className="h-12 px-7 rounded-xl dmoop-btn-primary text-[14px] font-semibold flex items-center gap-2"
            >
              {primaryLabel} <ArrowRight size={15} />
            </Link>
            <Link
              href="#features"
              className="h-12 px-7 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-[14px] font-semibold text-[var(--dmoop-text-primary)] hover:shadow-[var(--dmoop-shadow-md)] transition-all flex items-center gap-2"
            >
              See what it does
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-[var(--dmoop-text-tertiary)] dmoop-fade-in">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> No credit card</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> 60 topics scraped daily</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> 4 specialized models</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> Self-learning loop</span>
          </div>
        </div>

        {/* Product preview frame */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
          <div
            className="rounded-2xl overflow-hidden mx-auto"
            style={{
              background: "var(--dmoop-gradient-card)",
              border: "1px solid var(--dmoop-border-soft)",
              boxShadow: "var(--dmoop-shadow-xl)",
            }}
          >
            <div className="px-4 py-2.5 border-b border-[var(--dmoop-border-soft)] flex items-center gap-1.5 bg-[#f9f5ee]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e8a293]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#e8c993]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#a0c898]" />
              <span className="ml-3 text-[11px] font-medium text-[var(--dmoop-text-tertiary)]">DMOOP — Enterprise Marketing Intelligence</span>
            </div>
            <div className="p-6 sm:p-10 bg-gradient-to-br from-[#fdfcfa] to-[#f7f3eb]">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-white border border-[var(--dmoop-border-soft)] p-1.5 shrink-0 flex items-center justify-center shadow-[var(--dmoop-shadow-sm)]">
                  <Image src="/dmoop-logo.png" alt="DMOOP" width={60} height={20} className="w-full h-auto object-contain" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-[var(--dmoop-text-primary)]">DMOOP <span className="text-[var(--dmoop-accent)] ml-1">Core</span></p>
                  <p className="text-[13px] sm:text-[14px] text-[var(--dmoop-text-primary)] leading-relaxed mt-1.5">
                    Based on the last 7 days of intel, three trends are reshaping B2B demand gen:
                  </p>
                  <ul className="mt-2 text-[12.5px] sm:text-[13.5px] text-[var(--dmoop-text-primary)] space-y-1 ml-4 list-disc marker:text-[var(--dmoop-text-tertiary)]">
                    <li><strong className="font-semibold">AI Overviews</strong> are now responsible for 47% of zero-click queries — restructure pillar pages for citation eligibility <em className="text-[var(--dmoop-text-tertiary)] not-italic">[1]</em></li>
                    <li><strong className="font-semibold">Signal-led ABM</strong> beats persona-only ABM by 2.3× on meeting rate <em className="text-[var(--dmoop-text-tertiary)] not-italic">[2]</em></li>
                    <li><strong className="font-semibold">Cold outbound</strong> reply rates are at 5-year highs when paired with company-signal triggers <em className="text-[var(--dmoop-text-tertiary)] not-italic">[3]</em></li>
                  </ul>
                </div>
              </div>
              <div className="text-[11.5px] text-[var(--dmoop-text-tertiary)] pl-13 ml-13 pt-2 border-t border-[var(--dmoop-border-soft)]">
                Sources: searchengineland.com · gartner.com · hubspot.com
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────── */}
      <section id="features" className="relative py-16 sm:py-24 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-3">
              Capabilities
            </p>
            <h2 className="text-[28px] sm:text-[40px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-3 leading-tight">
              The full marketing surface, in one chat.
            </h2>
            <p className="text-[15px] text-[var(--dmoop-text-secondary)] max-w-2xl mx-auto">
              DMOOP isn&apos;t a single-task tool. It handles every marketing function with the same depth, grounded in real-time data.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {CAPABILITIES.map((c, i) => (
              <div
                key={c.title}
                style={{ animationDelay: `${i * 40}ms` }}
                className="group p-5 rounded-2xl bg-[var(--dmoop-gradient-card)] border border-[var(--dmoop-border-soft)] dmoop-card dmoop-stagger-in"
              >
                <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110`}
                  style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
                  <c.icon size={17} className={c.color} strokeWidth={2.2} />
                </div>
                <h3 className="text-[14px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-1">
                  {c.title}
                </h3>
                <p className="text-[12.5px] text-[var(--dmoop-text-secondary)] leading-relaxed">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section id="how" className="relative py-16 sm:py-24 border-t border-[var(--dmoop-border-soft)] bg-gradient-to-b from-transparent to-[#fbf6ec]/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-3">
              How it works
            </p>
            <h2 className="text-[28px] sm:text-[40px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-3 leading-tight">
              Three steps from question to insight.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {HOW_IT_WORKS.map((s, i) => (
              <div
                key={s.n}
                style={{ animationDelay: `${i * 80}ms` }}
                className="relative p-6 rounded-2xl bg-[var(--dmoop-gradient-card)] border border-[var(--dmoop-border-soft)] dmoop-card dmoop-stagger-in"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[28px] font-bold tracking-tight"
                    style={{
                      background: "var(--dmoop-gradient-accent)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}>
                    {s.n}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-[#fbf3ee] flex items-center justify-center" style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
                    <s.icon size={16} className="text-[var(--dmoop-accent)]" strokeWidth={2.2} />
                  </div>
                </div>
                <h3 className="text-[16px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2">
                  {s.title}
                </h3>
                <p className="text-[13px] text-[var(--dmoop-text-secondary)] leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Models ──────────────────────────────────────── */}
      <section id="models" className="relative py-16 sm:py-24 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-3">
              Models
            </p>
            <h2 className="text-[28px] sm:text-[40px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-3 leading-tight">
              Four models. One DMOOP.
            </h2>
            <p className="text-[15px] text-[var(--dmoop-text-secondary)] max-w-xl mx-auto">
              Pick the right brain for the task. Switch anytime mid-conversation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {MODELS.map((m, i) => (
              <div
                key={m.name}
                style={{ animationDelay: `${i * 60}ms` }}
                className="relative p-5 rounded-2xl bg-[var(--dmoop-gradient-card)] border border-[var(--dmoop-border-soft)] overflow-hidden dmoop-card dmoop-stagger-in"
              >
                <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${m.color} opacity-25 blur-2xl`} />
                <div className="relative">
                  <div className={`w-9 h-9 rounded-xl bg-white border border-[var(--dmoop-border-soft)] p-1.5 flex items-center justify-center mb-3`} style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
                    <Image src="/dmoop-logo.png" alt="DMOOP" width={50} height={16} className="w-full h-auto object-contain" />
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-[15px] font-bold tracking-tight text-[var(--dmoop-text-primary)]">{m.name}</h3>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wide uppercase"
                      style={{ background: "rgba(193,74,42,0.1)", color: "var(--dmoop-accent)" }}>
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--dmoop-text-secondary)] leading-relaxed">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────── */}
      <section className="relative py-16 sm:py-24 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="relative p-8 sm:p-12 rounded-3xl overflow-hidden"
            style={{
              background: "var(--dmoop-gradient-card)",
              border: "1px solid var(--dmoop-border-soft)",
              boxShadow: "var(--dmoop-shadow-xl)",
            }}>
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-[#d8593a]/30 to-[#b03e21]/30 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 blur-3xl pointer-events-none" />

            <div className="relative">
              <Zap size={32} className="mx-auto text-[var(--dmoop-accent)] mb-4" strokeWidth={2.2} />
              <h2 className="text-[26px] sm:text-[36px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-3 leading-tight">
                Try DMOOP free.
              </h2>
              <p className="text-[14px] sm:text-[15px] text-[var(--dmoop-text-secondary)] mb-6 max-w-md mx-auto">
                No credit card. No setup. Sign up and ask your first marketing question in under 60 seconds.
              </p>
              <Link
                href={primaryHref}
                className="h-12 px-7 rounded-xl dmoop-btn-primary text-[14px] font-semibold inline-flex items-center gap-2"
              >
                {primaryLabel} <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="relative py-8 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={100} height={28} className="h-6 w-auto" />
            <span className="text-[11px] text-[var(--dmoop-text-tertiary)]">© {new Date().getFullYear()} DMOOP</span>
          </div>
          <div className="flex items-center gap-5 text-[12px] text-[var(--dmoop-text-secondary)]">
            <Link href="/signin" className="hover:text-[var(--dmoop-text-primary)] transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-[var(--dmoop-text-primary)] transition-colors">Get started</Link>
            <span className="text-[var(--dmoop-text-tertiary)]">Enterprise marketing intelligence</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
