"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MessageSquare, ThumbsUp, Users, RefreshCw, Globe, ChevronRight, Search } from "lucide-react";

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

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<Interaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState("");
  const [intentFilter, setIntentFilter] = useState("");
  const [selected, setSelected] = useState<Interaction | null>(null);

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

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen" style={{ background: "var(--dmoop-bg-app)" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[var(--dmoop-border-soft)] bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-[13px] text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] transition-colors">
              <ArrowLeft size={15} />
              Back to chat
            </Link>
            <span className="h-4 w-px bg-[var(--dmoop-border-soft)]" />
            <Image src="/dmoop-logo.png" alt="DMOOP" width={100} height={32} className="h-7 w-auto" />
            <span className="text-[10px] font-bold tracking-[0.12em] text-[var(--dmoop-accent)] uppercase px-2 py-0.5 rounded-md" style={{ background: "rgba(193,74,42,0.1)" }}>
              Admin
            </span>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--dmoop-text-secondary)] transition-all duration-200 hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] hover:text-[var(--dmoop-text-primary)] active:scale-95">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Headline */}
        <div className="mb-7 dmoop-fade-in">
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--dmoop-text-primary)]">Admin Dashboard</h1>
          <p className="text-[13.5px] text-[var(--dmoop-text-secondary)] mt-1">All user activity. Visible only to admins.</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4 mb-7">
          <StatCard label="Total prompts" value={stats?.totals.interactions ?? "—"} icon={MessageSquare} accent="from-violet-500 to-fuchsia-500" />
          <StatCard label="Feedbacks received" value={stats?.totals.feedbacks ?? "—"} icon={ThumbsUp} accent="from-emerald-500 to-teal-500" />
          <StatCard label="Registered users" value={stats?.totals.users ?? "—"} icon={Users} accent="from-amber-500 to-orange-500" />
        </div>

        <div className="grid grid-cols-3 gap-5 mb-7">
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
          <div className="col-span-2 rounded-2xl p-5" style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-md)" }}>
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
          <div className="px-5 py-3.5 border-b border-[var(--dmoop-border-soft)] flex items-center justify-between gap-3">
            <p className="text-[13.5px] font-semibold text-[var(--dmoop-text-primary)]">
              All prompts <span className="text-[var(--dmoop-text-tertiary)] font-normal">· {total}</span>
            </p>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--dmoop-text-tertiary)]" />
                <input value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} placeholder="Filter by email…" onKeyDown={(e) => e.key === "Enter" && load()}
                  className="h-8 w-44 pl-7 pr-2.5 rounded-md text-[12px] bg-white border border-[var(--dmoop-border-soft)] focus:outline-none focus:border-[var(--dmoop-accent)]" />
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
                <option value="social">Social</option>
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
                className="w-full px-5 py-3.5 border-b border-[var(--dmoop-border-soft)] last:border-0 hover:bg-[#faf6ef] transition-colors text-left flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11.5px] font-semibold text-[var(--dmoop-text-primary)]">{item.user_email ?? "anonymous"}</span>
                    {item.intent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#f5f1ea] text-[var(--dmoop-text-secondary)] font-medium uppercase tracking-wide">
                        {item.intent.replace("_", " ")}
                      </span>
                    )}
                    {item.web_search_used && <Globe size={10} className="text-blue-500" />}
                    <span className="text-[10.5px] text-[var(--dmoop-text-tertiary)] ml-auto">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--dmoop-text-primary)] line-clamp-1">{item.user_query}</p>
                </div>
                <ChevronRight size={14} className="text-[var(--dmoop-text-tertiary)] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-30 flex items-center justify-center px-4 dmoop-fade-in" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative max-w-3xl w-full max-h-[80vh] rounded-2xl overflow-hidden dmoop-scale-in"
            style={{ background: "var(--dmoop-gradient-card)", boxShadow: "var(--dmoop-shadow-xl)", border: "1px solid var(--dmoop-border-soft)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-[var(--dmoop-border-soft)] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12.5px]">
                <span className="font-semibold text-[var(--dmoop-text-primary)]">{selected.user_email ?? "anonymous"}</span>
                <span className="text-[var(--dmoop-text-tertiary)]">·</span>
                <span className="text-[var(--dmoop-text-secondary)]">{selected.intent ?? "general"}</span>
                <span className="text-[var(--dmoop-text-tertiary)]">·</span>
                <span className="text-[var(--dmoop-text-tertiary)]">{selected.model}</span>
                <span className="text-[var(--dmoop-text-tertiary)]">·</span>
                <span className="text-[var(--dmoop-text-tertiary)]">{new Date(selected.created_at).toLocaleString()}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] text-sm font-medium">Close</button>
            </div>
            <div className="px-5 py-4 overflow-y-auto dmoop-scroll" style={{ maxHeight: "calc(80vh - 60px)" }}>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-1.5">Prompt</p>
              <p className="text-[14px] text-[var(--dmoop-text-primary)] mb-5 whitespace-pre-wrap leading-relaxed">{selected.user_query}</p>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-1.5">Response</p>
              <p className="text-[13.5px] text-[var(--dmoop-text-secondary)] whitespace-pre-wrap leading-[1.7]">{selected.response}</p>
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
          <p className="text-[30px] font-light text-[var(--dmoop-text-primary)] tracking-tight">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center`} style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
          <Icon size={16} className="text-white" strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}
