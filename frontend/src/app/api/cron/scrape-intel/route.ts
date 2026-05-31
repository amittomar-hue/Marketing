import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}
interface TavilyResponse {
  answer?: string;
  query: string;
  results: TavilyResult[];
}

// 60+ marketing-only topics. Will be refreshed multiple times per day
// (Vercel free tier limits crons but you can manually trigger).
const TOPICS: Array<{ category: string; query: string }> = [
  // ── SEO (8) ─────────────────────────────────────────────
  { category: "seo", query: "Latest Google SEO algorithm updates and ranking changes this week" },
  { category: "seo", query: "Technical SEO audit best practices 2026 Core Web Vitals" },
  { category: "seo", query: "Programmatic SEO case studies and tactics that work" },
  { category: "seo", query: "Link building strategies and backlink trends this month" },
  { category: "seo", query: "Local SEO updates Google Business Profile changes" },
  { category: "seo", query: "Schema markup structured data 2026 best practices" },
  { category: "seo", query: "Keyword research tactics and search intent analysis 2026" },
  { category: "seo", query: "Content gap analysis competitor SEO strategies this week" },

  // ── AEO / GEO (6) ────────────────────────────────────────
  { category: "aeo_geo", query: "AI Overviews citation strategies Google SGE tactics 2026" },
  { category: "aeo_geo", query: "ChatGPT visibility how to get cited by AI search" },
  { category: "aeo_geo", query: "Perplexity AI search optimization GEO tactics" },
  { category: "aeo_geo", query: "Generative engine optimization LLMO strategies 2026" },
  { category: "aeo_geo", query: "Entity SEO knowledge graph optimization 2026" },
  { category: "aeo_geo", query: "AI answer engine optimization Bing Copilot SearchGPT" },

  // ── ABM (5) ──────────────────────────────────────────────
  { category: "abm", query: "Account-based marketing tier-1 enterprise playbooks 2026" },
  { category: "abm", query: "ABM campaign orchestration multi-channel B2B" },
  { category: "abm", query: "Personalized outreach sequences ABM case studies" },
  { category: "abm", query: "Account-based marketing intent data 6sense Demandbase" },
  { category: "abm", query: "ABM measurement attribution pipeline impact 2026" },

  // ── Buyer Signals (4) ────────────────────────────────────
  { category: "buyer_signals", query: "B2B buyer intent data trends Bombora 6sense this week" },
  { category: "buyer_signals", query: "Predictive lead scoring propensity models 2026" },
  { category: "buyer_signals", query: "Sales intelligence buying committee signals 2026" },
  { category: "buyer_signals", query: "Intent signal interpretation behavioral triggers B2B" },

  // ── Company Signals (4) ──────────────────────────────────
  { category: "company_signals", query: "B2B company hiring trends funding announcements this week" },
  { category: "company_signals", query: "Marketing leadership moves CMO changes this month" },
  { category: "company_signals", query: "Tech stack shifts MarTech changes Bombora technographic" },
  { category: "company_signals", query: "Enterprise SaaS M&A acquisitions marketing news this week" },

  // ── ORM (4) ──────────────────────────────────────────────
  { category: "orm", query: "Brand reputation crises online reputation management this week" },
  { category: "orm", query: "Review response strategy G2 Capterra Trustpilot tactics" },
  { category: "orm", query: "Social sentiment monitoring brand mention tracking 2026" },
  { category: "orm", query: "Executive thought leadership LinkedIn personal branding 2026" },

  // ── Ad Copy (5) ──────────────────────────────────────────
  { category: "ad_copy", query: "Top performing Google Ads search ad copy patterns this week" },
  { category: "ad_copy", query: "Meta Ads Facebook Instagram creative trends that convert" },
  { category: "ad_copy", query: "LinkedIn Ads B2B copy that drives pipeline 2026" },
  { category: "ad_copy", query: "TikTok ad creative trends viral hooks 2026" },
  { category: "ad_copy", query: "Retail media ads Amazon Walmart sponsored placements 2026" },

  // ── Email (5) ────────────────────────────────────────────
  { category: "email", query: "Email marketing benchmarks open rates CTR by industry 2026" },
  { category: "email", query: "Subject line A/B testing winning patterns this month" },
  { category: "email", query: "Email deliverability Gmail Yahoo bulk sender requirements 2026" },
  { category: "email", query: "B2B cold email sequences that book meetings 2026" },
  { category: "email", query: "Lifecycle email nurture sequences SaaS onboarding 2026" },

  // ── Trends (5) ───────────────────────────────────────────
  { category: "trend", query: "Marketing trends this week social media B2B B2C" },
  { category: "trend", query: "TikTok Instagram LinkedIn marketing trends viral content 2026" },
  { category: "trend", query: "Creator economy influencer marketing trends this week" },
  { category: "trend", query: "Marketing technology emerging tools AI MarTech 2026" },
  { category: "trend", query: "Consumer behavior shifts marketing implications Q2 2026" },

  // ── Demand Gen (5) ───────────────────────────────────────
  { category: "demand_gen", query: "B2B demand generation tactics pipeline experiments this week" },
  { category: "demand_gen", query: "Marketing attribution MMM MTA incrementality 2026" },
  { category: "demand_gen", query: "Referral program partner marketing case studies 2026" },
  { category: "demand_gen", query: "Webinar marketing virtual events high-converting formats 2026" },
  { category: "demand_gen", query: "Product-led growth PLG marketing tactics SaaS 2026" },

  // ── Analytics (4) ────────────────────────────────────────
  { category: "analytics", query: "MarTech stack 2026 trends consolidation tools" },
  { category: "analytics", query: "Marketing attribution multi-touch first-party data 2026" },
  { category: "analytics", query: "GA4 Looker Studio reporting best practices 2026" },
  { category: "analytics", query: "Customer data platform CDP implementation playbooks 2026" },

  // ── Strategy & Positioning (4) ──────────────────────────
  { category: "strategy", query: "Category creation positioning playbooks B2B SaaS 2026" },
  { category: "strategy", query: "Pricing strategy packaging changes SaaS 2026" },
  { category: "strategy", query: "GTM strategy product launch best practices 2026" },
  { category: "strategy", query: "Brand strategy positioning frameworks JTBD StoryBrand 2026" },

  // ── Competitor & Market Intel (3) ────────────────────────
  { category: "competitor", query: "B2B SaaS competitive teardowns positioning analysis this week" },
  { category: "competitor", query: "Competitive intelligence tools win-loss analysis 2026" },
  { category: "competitor", query: "Market sizing TAM SAM SOM frameworks 2026" },
];

async function tavilySearch(query: string, apiKey: string): Promise<TavilyResponse | null> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        include_answer: false,
        max_results: 5,
        topic: "news",
        days: 7,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron && process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) return NextResponse.json({ error: "TAVILY_API_KEY missing" }, { status: 503 });

  const supa = getSupabase();
  if (!supa) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  // Optional: limit topics this run (default: half the topics, so we cover all twice a day)
  const url = req.nextUrl;
  const slice = url.searchParams.get("slice"); // "0" = first half, "1" = second half, null = all
  let topicsForRun = TOPICS;
  if (slice === "0") topicsForRun = TOPICS.slice(0, Math.ceil(TOPICS.length / 2));
  if (slice === "1") topicsForRun = TOPICS.slice(Math.ceil(TOPICS.length / 2));

  const { data: runRow } = await supa
    .from("intel_scrape_runs")
    .insert({ topics_run: topicsForRun.length })
    .select("id")
    .single();
  const runId = runRow?.id;

  let added = 0;
  let skipped = 0;
  const startedAt = Date.now();

  // Concurrency 4 — respects Tavily rate limits
  const batchSize = 4;
  for (let i = 0; i < topicsForRun.length; i += batchSize) {
    const batch = topicsForRun.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (t) => {
      const tav = await tavilySearch(t.query, tavilyKey);
      if (!tav) return [];
      return tav.results.map((r) => ({
        topic: t.query,
        category: t.category,
        title: r.title,
        url: r.url,
        summary: r.content?.slice(0, 1500) ?? null,
        source: new URL(r.url).hostname.replace(/^www\./, ""),
        relevance: r.score,
        published_at: r.published_date ?? null,
      }));
    }));

    for (const items of results) {
      for (const item of items) {
        const { error } = await supa.from("marketing_intel").insert(item);
        if (error) {
          if (error.code === "23505") skipped++;
          else console.error("intel insert error:", error.message);
        } else {
          added++;
        }
      }
    }
  }

  if (runId) {
    await supa
      .from("intel_scrape_runs")
      .update({
        finished_at: new Date().toISOString(),
        items_added: added,
        items_skipped: skipped,
      })
      .eq("id", runId);
  }

  return NextResponse.json({
    ok: true,
    run_id: runId,
    topics: topicsForRun.length,
    items_added: added,
    items_skipped: skipped,
    duration_ms: Date.now() - startedAt,
  });
}
