import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

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

// 12 marketing-only topics refreshed every day.
// Categories align with the intent taxonomy in supabase.ts so we can pair
// scraped intel with user queries.
const TOPICS: Array<{ category: string; query: string }> = [
  { category: "seo",             query: "Latest Google SEO algorithm updates this week site:searchengineland.com OR site:searchenginejournal.com" },
  { category: "aeo_geo",         query: "AI Overviews citation strategies, Perplexity SEO, ChatGPT citation tactics 2026" },
  { category: "abm",             query: "Account-based marketing playbooks and case studies, B2B targeting trends this week" },
  { category: "buyer_signals",   query: "B2B buyer intent data trends, Bombora 6sense Demandbase research this week" },
  { category: "company_signals", query: "B2B company signal intelligence, hiring trends, funding announcements, marketing leadership moves this week" },
  { category: "orm",             query: "Brand reputation crises, online reputation management case studies this week" },
  { category: "ad_copy",         query: "Top performing ad copy patterns, Google Ads Meta Ads creative trends this week" },
  { category: "email",           query: "Email marketing benchmarks, subject line performance, deliverability changes 2026" },
  { category: "trend",           query: "Marketing trends this week, social media trends, TikTok Instagram LinkedIn marketing" },
  { category: "demand_gen",      query: "B2B demand generation tactics, pipeline experiments, ABM-led demand gen results this week" },
  { category: "analytics",       query: "Marketing analytics MMM MTA attribution trends, MarTech stack changes 2026" },
  { category: "competitor",      query: "Competitive marketing intelligence, brand teardowns, positioning shifts this week" },
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
  // Allow Vercel cron OR explicit secret
  const auth = req.headers.get("authorization");
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron && process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) return NextResponse.json({ error: "TAVILY_API_KEY missing" }, { status: 503 });

  const supa = getSupabase();
  if (!supa) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  // Start a scrape run
  const { data: runRow } = await supa
    .from("intel_scrape_runs")
    .insert({ topics_run: TOPICS.length })
    .select("id")
    .single();
  const runId = runRow?.id;

  let added = 0;
  let skipped = 0;
  const startedAt = Date.now();

  // Run topics in parallel but with a small concurrency cap to respect Tavily rate limits
  const batchSize = 3;
  for (let i = 0; i < TOPICS.length; i += batchSize) {
    const batch = TOPICS.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (t) => {
      const tav = await tavilySearch(t.query, tavilyKey);
      if (!tav) return [];
      return tav.results.map((r) => ({
        topic: t.query,
        category: t.category,
        title: r.title,
        url: r.url,
        summary: r.content?.slice(0, 800) ?? null,
        source: new URL(r.url).hostname.replace(/^www\./, ""),
        relevance: r.score,
        published_at: r.published_date ?? null,
      }));
    }));

    for (const items of results) {
      for (const item of items) {
        const { error } = await supa
          .from("marketing_intel")
          .insert(item);
        if (error) {
          // Duplicate URL — counts as skipped
          if (error.code === "23505") skipped++;
          else console.error("intel insert error:", error.message);
        } else {
          added++;
        }
      }
    }
  }

  // Close run record
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
    topics: TOPICS.length,
    items_added: added,
    items_skipped: skipped,
    duration_ms: Date.now() - startedAt,
  });
}
