"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MessageSquare, ThumbsUp, ThumbsDown, Users, RefreshCw, Globe, ChevronRight, Search, Radar, ExternalLink, Clock, Brain, Zap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface Interaction {
  id: string;
  user_query: string;
  intent: string | null;
  response: string;
  model: string;
  user_email: string | null;
  web_search_used: boolean;
  created_at: string;
}

interface Stats {
  totals: { interactions: number; feedbacks: number; users: number };
  by_intent: { intent: string; count: number }[];
  by_user: { user_email: string; count: number; last_activity: string }[];
}

interface IntelItem {
  id: string;
  topic: string;
  category: string;
  title: string;
  url: string;
  summary: string | null;
  source: string | null;
  scraped_at: string;
}

interface IntelRunInfo {
  started_at: string;
  finished_at: string | null;
  items_added: number;
  items_skipped: number;
}

interface LearningHealth {
  total_interactions: number;
  positive: number;
  negative: number;
  total_examples: number;
  examples_actually_used: number;
  total_retrievals: number;
  negative_patterns_logged: number;
  last_retrieval_at: string | null;
}
interface LearningExample {
  id: string;
  intent: string;
  query_summary: string;
  exemplar_response: string;
  score: number;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
}
interface NegativePattern {
  id: string;
  intent: string;
  query_text: string;
  reason: string | null;
  created_at: string;
}

export default function AdminPage() {
  const [tab, setTab] = useState<"prompts" | "intel" | "learning">("prompts");
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<Interaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState("");
  const [intentFilter, setIntentFilter] = useState("");
  const [selected, setSelected] = useState<Interaction | null>(null);

  // Intel state
  const [intel, setIntel] = useState<IntelItem[]>([]);
  const [intelCategory, setIntelCategory] = useState("");
  const [lastRun, setLastRun] = useState<IntelRunInfo | null>(null);
  const [scraping, setScraping] = useState(false);

  // Learning state
  const [learningHealth, setLearningHealth] = useState<LearningHealth | null>(null);
  const [learningExamples, setLearningExamples] = useState<LearningExample[]>([]);
  const [negativePatterns, setNegativePatterns] = useState<NegativePattern[]>([]);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (emailFilter) params.set("email", emailFilter);
    if (intentFilter) params.set("intent", intentFilter);
    const [statsRes, itemsRes] = await Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch(`/api/admin/interactions?${params}`).then((r) => r.json()),
    ]);
    setStats(statsRes);
    setItems(itemsRes.items ?? []);
    setTotal(itemsRes.total ?? 0);
    setLoading(false);
  };

  const loadIntel = async () => {
    const params = new URLSearchParams({ limit: "100" });
    if (intelCategory) params.set("category", intelCategory);
    const res = await fetch(`/api/admin/intel?${params}`).then((r) => r.json());
    setIntel(res.items ?? []);
    setLastRun(res.last_run ?? null);
  };

  const triggerScrape = async () => {
    setScraping(true);
    await fetch("/api/cron/scrape-intel", { method: "GET" });
    await loadIntel();
    setScraping(false);
  };

  const loadLearning = async () => {
    const res = await fetch("/api/admin/learning").then((r) => r.json());
    setLearningHealth(res.health);
    setLearningExamples(res.examples ?? []);
    setNegativePatterns(res.negatives ?? []);
  };

  useEffect(() => { load(); loadIntel(); loadLearning(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === "intel") loadIntel(); }, [intelCategory]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === "learning") loadLearning(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen" style={{ background: "var(--dmoop-bg-app)" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[var(--dmoop-border-soft)] bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-1.5 text-[12.5px] text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] transition-colors shrink-0">
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Back to chat</span>
            </Link>
            <span className="h-4 w-px bg-[var(--dmoop-border-soft)] hidden sm:block" />
            <Image src="/dmoop-logo.png" alt="DMOOP" width={100} height={32} className="h-6 sm:h-7 w-auto" />
            <span className="text-[9.5px] sm:text-[10px] font-bold tracking-[0.12em] text-[var(--dmoop-accent)] uppercase px-1.5 sm:px-2 py-0.5 rounded-md shrink-0" style={{ background: "rgba(193,74,42,0.1)" }}>
              Admin
            </span>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--dmoop-text-secondary)] transition-all duration-200 hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] hover:text-[var(--dmoop-text-primary)] active:scale-95 shrink-0">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Headline */}
        <div className="mb-5 dmoop-fade-in">
          <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-tight text-[var(--dmoop-text-primary)]">Admin Dashboard</h1>
          <p className="text-[12.5px] sm:text-[13.5px] text-[var(--dmoop-text-secondary)] mt-1">All user activity + live marketing intel. Visible only to admins.</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-[var(--dmoop-border-soft)]">
          {[
            { key: "prompts" as const, label: "User Prompts", icon: MessageSquare },
            { key: "intel" as const, label: "Marketing Intel", icon: Radar },
            { key: "learning" as const, label: "Self-Learning", icon: Brain },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 -mb-px text-[13px] font-semibold border-b-2 transition-all duration-200",
                tab === t.key
                  ? "text-[var(--dmoop-accent)] border-[var(--dmoop-accent)]"
                  : "text-[var(--dmoop-text-secondary)] border-transparent hover:text-[var(--dmoop-text-primary)]"
              )}>
              <t.icon size={13} strokeWidth={2.2} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "prompts" ? (
        <>
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-7">
          <StatCard label="Total prompts" value={stats?.totals.interactions ?? "—"} icon={MessageSquare} accent="from-violet-500 to-fuchsia-500" />
          <StatCard label="Feedbacks received" value={stats?.totals.feedbacks ?? "—"} icon={ThumbsUp} accent="from-emerald-500 to-teal-500" />
          <StatCard label="Registered users" value={stats?.totals.users ?? "—"} icon={Users} accent="from-amber-500 to-orange-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-6 sm:mb-7">
          {/* Top intents */}
          <div className="rounded-2xl p-5" style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-md)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-3">Top intents</p>
            <div className="flex flex-col gap-2">
              {(stats?.by_intent ?? []).slice(0, 7).map((b) => (
                <div key={b.intent} className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--dmoop-text-primary)] font-medium">{b.intent.replace("_", " ")}</span>
                  <span className="text-[var(--dmoop-text-secondary)] font-mono">{b.count}</span>
                </div>
              ))}
              {(stats?.by_intent ?? []).length === 0 && <p className="text-[12px] text-[var(--dmoop-text-tertiary)]">No data yet</p>}
            </div>
          </div>

          {/* Top users */}
          <div className="md:col-span-2 rounded-2xl p-5" style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-md)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-3">Most active users</p>
            <div className="flex flex-col gap-1.5">
              {(stats?.by_user ?? []).slice(0, 7).map((b) => (
                <button key={b.user_email} onClick={() => setEmailFilter(b.user_email)}
                  className="flex items-center justify-between gap-3 text-[13px] py-1.5 px-2 rounded-lg hover:bg-[#faf6ef] transition-colors text-left">
                  <span className="text-[var(--dmoop-text-primary)] font-medium truncate">{b.user_email}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[var(--dmoop-text-secondary)] font-mono">{b.count}</span>
                    <span className="text-[11px] text-[var(--dmoop-text-tertiary)]">
                      {new Date(b.last_activity).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
              {(stats?.by_user ?? []).length === 0 && <p className="text-[12px] text-[var(--dmoop-text-tertiary)]">No data yet</p>}
            </div>
          </div>
        </div>

        {/* Interactions table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-md)" }}>
          <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--dmoop-border-soft)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[13.5px] font-semibold text-[var(--dmoop-text-primary)]">
              All prompts <span className="text-[var(--dmoop-text-tertiary)] font-normal">· {total}</span>
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 sm:flex-initial min-w-[140px]">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--dmoop-text-tertiary)]" />
                <input value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} placeholder="Filter by email…" onKeyDown={(e) => e.key === "Enter" && load()}
                  className="h-8 w-full sm:w-44 pl-7 pr-2.5 rounded-md text-[12px] bg-white border border-[var(--dmoop-border-soft)] focus:outline-none focus:border-[var(--dmoop-accent)]" />
              </div>
              <select value={intentFilter} onChange={(e) => { setIntentFilter(e.target.value); }}
                className="h-8 px-2 rounded-md text-[12px] bg-white border border-[var(--dmoop-border-soft)] focus:outline-none focus:border-[var(--dmoop-accent)]">
                <option value="">All intents</option>
                <option value="ad_copy">Ad copy</option>
                <option value="email">Email</option>
                <option value="trend">Trend</option>
                <option value="strategy">Strategy</option>
                <option value="competitor">Competitor</option>
                <option value="brand_voice">Brand voice</option>
                <option value="seo">SEO</option>
                <option value="aeo_geo">AEO / GEO</option>
                <option value="abm">ABM</option>
                <option value="buyer_signals">Buyer signals</option>
                <option value="company_signals">Company signals</option>
                <option value="orm">ORM</option>
                <option value="general">General</option>
              </select>
              <button onClick={load} className="h-8 px-3 rounded-md text-[12px] dmoop-btn-primary font-semibold">Apply</button>
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto dmoop-scroll">
            {items.length === 0 && !loading && (
              <p className="text-center text-[13px] text-[var(--dmoop-text-tertiary)] py-12">No prompts match.</p>
            )}
            {items.map((item) => (
              <button key={item.id} onClick={() => setSelected(item)}
                className="w-full px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[var(--dmoop-border-soft)] last:border-0 hover:bg-[#faf6ef] transition-colors text-left flex items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                    <span className="text-[11.5px] font-semibold text-[var(--dmoop-text-primary)] truncate max-w-[160px]">{item.user_email ?? "anonymous"}</span>
                    {item.intent && (
                      <span className="text-[9.5px] sm:text-[10px] px-1.5 py-0.5 rounded-md bg-[#f5f1ea] text-[var(--dmoop-text-secondary)] font-medium uppercase tracking-wide">
                        {item.intent.replace("_", " ")}
                      </span>
                    )}
                    {item.web_search_used && <Globe size={10} className="text-blue-500" />}
                    <span className="text-[10px] sm:text-[10.5px] text-[var(--dmoop-text-tertiary)] sm:ml-auto">
                      {new Date(item.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[12.5px] sm:text-[13px] text-[var(--dmoop-text-primary)] line-clamp-1">{item.user_query}</p>
                </div>
                <ChevronRight size={14} className="text-[var(--dmoop-text-tertiary)] shrink-0" />
              </button>
            ))}
          </div>
        </div>
        </>
        ) : tab === "intel" ? (
          <IntelPanel
            intel={intel}
            lastRun={lastRun}
            intelCategory={intelCategory}
            setIntelCategory={setIntelCategory}
            triggerScrape={triggerScrape}
            scraping={scraping}
          />
        ) : (
          <LearningPanel
            health={learningHealth}
            examples={learningExamples}
            negatives={negativePatterns}
            onRefresh={loadLearning}
          />
        )}
      </main>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center px-0 sm:px-4 dmoop-fade-in" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative max-w-3xl w-full max-h-[85vh] sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden dmoop-scale-in"
            style={{ background: "var(--dmoop-gradient-card)", boxShadow: "var(--dmoop-shadow-xl)", border: "1px solid var(--dmoop-border-soft)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[var(--dmoop-border-soft)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11.5px] sm:text-[12.5px] min-w-0 flex-wrap">
                <span className="font-semibold text-[var(--dmoop-text-primary)] truncate">{selected.user_email ?? "anonymous"}</span>
                <span className="text-[var(--dmoop-text-tertiary)]">·</span>
                <span className="text-[var(--dmoop-text-secondary)]">{selected.intent ?? "general"}</span>
                <span className="text-[var(--dmoop-text-tertiary)] hidden sm:inline">·</span>
                <span className="text-[var(--dmoop-text-tertiary)] hidden sm:inline">{selected.model}</span>
                <span className="text-[var(--dmoop-text-tertiary)] hidden md:inline">·</span>
                <span className="text-[var(--dmoop-text-tertiary)] hidden md:inline">{new Date(selected.created_at).toLocaleString()}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] text-sm font-medium shrink-0">Close</button>
            </div>
            <div className="px-4 sm:px-5 py-4 overflow-y-auto dmoop-scroll" style={{ maxHeight: "calc(85vh - 60px)" }}>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-1.5">Prompt</p>
              <p className="text-[13.5px] sm:text-[14px] text-[var(--dmoop-text-primary)] mb-5 whitespace-pre-wrap leading-relaxed">{selected.user_query}</p>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-1.5">Response</p>
              <p className="text-[13px] sm:text-[13.5px] text-[var(--dmoop-text-secondary)] whitespace-pre-wrap leading-[1.7]">{selected.response}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size: number; className?: string; strokeWidth?: number }>;
  accent: string;
}) {
  return (
    <div className="relative p-5 rounded-2xl overflow-hidden dmoop-card">
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-1.5">{label}</p>
          <p className="text-[30px] font-medium text-[var(--dmoop-text-primary)] tracking-tight">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center`} style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
          <Icon size={16} className="text-white" strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

const INTEL_CATEGORIES = [
  { value: "", label: "All categories" },
  { value: "seo", label: "SEO" },
  { value: "aeo_geo", label: "AEO / GEO" },
  { value: "abm", label: "ABM" },
  { value: "buyer_signals", label: "Buyer signals" },
  { value: "company_signals", label: "Company signals" },
  { value: "orm", label: "ORM" },
  { value: "ad_copy", label: "Ad copy" },
  { value: "email", label: "Email" },
  { value: "trend", label: "Trends" },
  { value: "demand_gen", label: "Demand gen" },
  { value: "analytics", label: "Analytics" },
  { value: "competitor", label: "Competitor" },
];

function LearningPanel({
  health, examples, negatives, onRefresh,
}: {
  health: LearningHealth | null;
  examples: LearningExample[];
  negatives: NegativePattern[];
  onRefresh: () => void;
}) {
  const positiveRate = health
    ? ((health.positive / Math.max(1, health.positive + health.negative)) * 100).toFixed(0)
    : "—";
  const retrievalRate = health
    ? ((health.examples_actually_used / Math.max(1, health.total_examples)) * 100).toFixed(0)
    : "—";

  return (
    <>
      {/* Header strip */}
      <div className="rounded-2xl p-4 sm:p-5 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-md)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--dmoop-gradient-accent)", boxShadow: "var(--dmoop-shadow-accent)" }}>
            <Brain size={17} className="text-white" />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-[var(--dmoop-text-primary)]">Self-Learning Loop</p>
            <p className="text-[11.5px] text-[var(--dmoop-text-secondary)] mt-0.5">
              Thumbs-up promotes responses to retrieval examples. Thumbs-down logs patterns to avoid.
              Retrieval ranks by query similarity + score + recency.
            </p>
          </div>
        </div>
        <button onClick={onRefresh}
          className="h-9 px-3 rounded-lg text-[12.5px] font-semibold text-[var(--dmoop-text-secondary)] hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] hover:text-[var(--dmoop-text-primary)] flex items-center gap-2 shrink-0">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MiniStat label="Interactions" value={health?.total_interactions ?? "—"} icon={Activity} accent="violet" />
        <MiniStat label="👍 Approval rate" value={`${positiveRate}%`} icon={ThumbsUp} accent="emerald" />
        <MiniStat label="Examples in use" value={`${retrievalRate}%`} icon={Zap} accent="amber" />
        <MiniStat label="Patterns to avoid" value={health?.negative_patterns_logged ?? "—"} icon={ThumbsDown} accent="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Positive examples */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-md)" }}>
          <div className="px-4 py-3 border-b border-[var(--dmoop-border-soft)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThumbsUp size={13} className="text-emerald-600" />
              <p className="text-[13.5px] font-semibold text-[var(--dmoop-text-primary)]">High-rated examples · {examples.length}</p>
            </div>
            <span className="text-[10.5px] text-[var(--dmoop-text-tertiary)]">Used in future similar queries</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto dmoop-scroll">
            {examples.length === 0 && (
              <p className="text-center text-[12.5px] text-[var(--dmoop-text-tertiary)] py-10">
                No high-rated examples yet. Thumbs-up responses you like.
              </p>
            )}
            {examples.map((ex) => (
              <div key={ex.id} className="px-4 py-3 border-b border-[var(--dmoop-border-soft)] last:border-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold uppercase tracking-wide">
                    {ex.intent.replace("_", " ")}
                  </span>
                  <span className="text-[10.5px] font-mono text-[var(--dmoop-text-tertiary)]">
                    score {ex.score} · used {ex.usage_count}×
                  </span>
                  <span className="text-[10.5px] text-[var(--dmoop-text-tertiary)] ml-auto">
                    {new Date(ex.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-[12.5px] text-[var(--dmoop-text-primary)] line-clamp-2">{ex.query_summary}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Negative patterns */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-md)" }}>
          <div className="px-4 py-3 border-b border-[var(--dmoop-border-soft)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThumbsDown size={13} className="text-rose-500" />
              <p className="text-[13.5px] font-semibold text-[var(--dmoop-text-primary)]">Patterns to avoid · {negatives.length}</p>
            </div>
            <span className="text-[10.5px] text-[var(--dmoop-text-tertiary)]">Future responses steer clear</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto dmoop-scroll">
            {negatives.length === 0 && (
              <p className="text-center text-[12.5px] text-[var(--dmoop-text-tertiary)] py-10">
                No flagged patterns yet. Thumbs-down responses that miss the mark.
              </p>
            )}
            {negatives.map((n) => (
              <div key={n.id} className="px-4 py-3 border-b border-[var(--dmoop-border-soft)] last:border-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold uppercase tracking-wide">
                    {n.intent.replace("_", " ")}
                  </span>
                  <span className="text-[10.5px] text-[var(--dmoop-text-tertiary)] ml-auto">
                    {new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-[12.5px] text-[var(--dmoop-text-primary)] line-clamp-2">{n.query_text}</p>
                {n.reason && (
                  <p className="text-[11px] text-[var(--dmoop-text-tertiary)] mt-1 italic">— {n.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value, icon: Icon, accent }: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size: number; className?: string; strokeWidth?: number }>;
  accent: "violet" | "emerald" | "amber" | "rose";
}) {
  const colors: Record<typeof accent, { bg: string; text: string }> = {
    violet:  { bg: "from-violet-500/15 to-fuchsia-500/15",  text: "text-violet-700" },
    emerald: { bg: "from-emerald-500/15 to-teal-500/15",    text: "text-emerald-700" },
    amber:   { bg: "from-amber-500/15 to-orange-500/15",    text: "text-amber-700" },
    rose:    { bg: "from-rose-500/15 to-red-500/15",        text: "text-rose-700" },
  };
  return (
    <div className="relative p-4 rounded-2xl overflow-hidden dmoop-card">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${colors[accent].bg} blur-2xl pointer-events-none`} />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-1">{label}</p>
          <p className="text-[22px] font-semibold text-[var(--dmoop-text-primary)] tracking-tight">{value}</p>
        </div>
        <Icon size={14} className={colors[accent].text} strokeWidth={2.2} />
      </div>
    </div>
  );
}

function IntelPanel({
  intel,
  lastRun,
  intelCategory,
  setIntelCategory,
  triggerScrape,
  scraping,
}: {
  intel: IntelItem[];
  lastRun: IntelRunInfo | null;
  intelCategory: string;
  setIntelCategory: (v: string) => void;
  triggerScrape: () => void;
  scraping: boolean;
}) {
  return (
    <>
      {/* Status strip */}
      <div className="rounded-2xl p-4 sm:p-5 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-md)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--dmoop-gradient-accent)", boxShadow: "var(--dmoop-shadow-accent)" }}>
            <Radar size={17} className="text-white" />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-[var(--dmoop-text-primary)]">Background marketing intel</p>
            <p className="text-[11.5px] text-[var(--dmoop-text-secondary)] mt-0.5">
              Scrapes 12 marketing topics from across the web daily via Tavily, stored for chat context.
            </p>
          </div>
        </div>
        <button onClick={triggerScrape} disabled={scraping}
          className="h-9 px-4 rounded-lg dmoop-btn-primary text-[12.5px] font-semibold flex items-center justify-center gap-2 shrink-0">
          {scraping ? <><RefreshCw size={13} className="animate-spin" /> Scraping…</> : <><RefreshCw size={13} /> Scrape now</>}
        </button>
      </div>

      {/* Last run + filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-[12px] text-[var(--dmoop-text-secondary)]">
          <Clock size={12} />
          {lastRun ? (
            <>
              Last run {new Date(lastRun.started_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              <span className="text-[var(--dmoop-text-tertiary)]">·</span>
              <span className="font-semibold text-emerald-600">+{lastRun.items_added}</span>
              <span className="text-[var(--dmoop-text-tertiary)]">added</span>
              <span className="text-[var(--dmoop-text-tertiary)]">·</span>
              <span>{lastRun.items_skipped} dedup&apos;d</span>
            </>
          ) : "No scrape runs yet"}
        </div>
        <select value={intelCategory} onChange={(e) => setIntelCategory(e.target.value)}
          className="h-8 px-3 rounded-md text-[12.5px] bg-white border border-[var(--dmoop-border-soft)] focus:outline-none focus:border-[var(--dmoop-accent)]">
          {INTEL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Intel cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {intel.length === 0 && (
          <div className="col-span-full text-center py-12 text-[13px] text-[var(--dmoop-text-tertiary)] rounded-2xl"
            style={{ background: "var(--dmoop-gradient-card)", border: "1px dashed var(--dmoop-border-soft)" }}>
            No intel scraped yet. Click <strong>Scrape now</strong> above to prime the data.
          </div>
        )}
        {intel.map((i) => (
          <a key={i.id} href={i.url} target="_blank" rel="noopener noreferrer"
            className="group block p-4 rounded-2xl overflow-hidden dmoop-card">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-[#f5f1ea] text-[var(--dmoop-text-secondary)] font-semibold uppercase tracking-wide">
                {i.category.replace("_", " ")}
              </span>
              {i.source && (
                <span className="text-[10.5px] text-[var(--dmoop-text-tertiary)]">{i.source}</span>
              )}
              <span className="text-[10.5px] text-[var(--dmoop-text-tertiary)] ml-auto">
                {new Date(i.scraped_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
            <p className="text-[14px] font-semibold text-[var(--dmoop-text-primary)] mb-1.5 leading-snug line-clamp-2 group-hover:text-[var(--dmoop-accent)] transition-colors">
              {i.title}
            </p>
            {i.summary && (
              <p className="text-[12px] text-[var(--dmoop-text-secondary)] line-clamp-3 leading-relaxed">{i.summary}</p>
            )}
            <div className="flex items-center gap-1 mt-2.5 text-[11px] text-[var(--dmoop-text-tertiary)] group-hover:text-[var(--dmoop-accent)] transition-colors">
              <ExternalLink size={10} /> Open source
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
