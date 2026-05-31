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

type AssetType =
  | "article"        // blog posts / news
  | "whitepaper"     // formal research papers, gated PDFs
  | "ebook"          // long-form guides
  | "playbook"       // tactical step-by-step guides
  | "case_study"     // customer success stories with metrics
  | "social_post"    // LinkedIn / X / Threads viral marketing posts
  | "ad_campaign"    // ad creative breakdowns / campaign analyses
  | "report"         // Gartner/Forrester-style industry reports
  | "newsletter"     // recurring publications (Morning Brew, TLDR Marketing)
  | "podcast"        // podcast episode summaries / show notes
  | "video"          // video / webinar transcripts
  | "template"       // downloadable templates / frameworks
  | "guide";         // how-to guides

interface Topic {
  category: string;
  asset_type: AssetType;
  query: string;
  /** How many days back to search. Newer for time-sensitive (news), older OK for evergreen (playbooks) */
  days?: number;
  topic?: "news" | "general";
}

// ─────────────────────────────────────────────────────────────────
// MASSIVE expanded TOPICS — 130+ queries covering all asset types
// across all marketing categories.
// ─────────────────────────────────────────────────────────────────
const TOPICS: Topic[] = [
  // ━━━━━━ ARTICLES / NEWS (high-frequency, time-sensitive) ━━━━━━
  { category: "seo",             asset_type: "article", query: "Latest Google SEO algorithm updates ranking changes this week", days: 7 },
  { category: "seo",             asset_type: "article", query: "Technical SEO Core Web Vitals 2026 best practices", days: 14 },
  { category: "aeo_geo",         asset_type: "article", query: "AI Overviews citation strategies Google SGE Perplexity 2026", days: 14 },
  { category: "aeo_geo",         asset_type: "article", query: "Generative engine optimization LLMO GEO tactics ChatGPT visibility", days: 14 },
  { category: "trend",           asset_type: "article", query: "Marketing trends this week social media B2B B2C", days: 7 },
  { category: "trend",           asset_type: "article", query: "TikTok Instagram LinkedIn marketing trends viral content 2026", days: 7 },
  { category: "company_signals", asset_type: "article", query: "B2B company hiring trends funding announcements marketing this week", days: 7 },
  { category: "company_signals", asset_type: "article", query: "CMO changes marketing leadership moves this month", days: 30 },

  // ━━━━━━ EBOOKS (long-form guides, evergreen) ━━━━━━
  { category: "seo",             asset_type: "ebook", query: '"SEO ebook" OR "complete SEO guide" download 2026', days: 365 },
  { category: "abm",             asset_type: "ebook", query: '"ABM ebook" account-based marketing complete guide download', days: 365 },
  { category: "demand_gen",      asset_type: "ebook", query: '"demand generation ebook" B2B SaaS guide download', days: 365 },
  { category: "ad_copy",         asset_type: "ebook", query: '"copywriting ebook" OR "ad copy ebook" download', days: 365 },
  { category: "email",           asset_type: "ebook", query: '"email marketing ebook" deliverability OR lifecycle download', days: 365 },
  { category: "analytics",       asset_type: "ebook", query: '"marketing analytics ebook" attribution measurement download', days: 365 },
  { category: "strategy",        asset_type: "ebook", query: '"GTM strategy ebook" OR "go-to-market guide" B2B SaaS download', days: 365 },
  { category: "buyer_signals",   asset_type: "ebook", query: '"intent data ebook" buyer signals B2B download', days: 365 },
  { category: "orm",             asset_type: "ebook", query: '"brand reputation ebook" online reputation management guide', days: 365 },

  // ━━━━━━ WHITEPAPERS (formal research, evidence-based) ━━━━━━
  { category: "abm",             asset_type: "whitepaper", query: 'ABM whitepaper "account based marketing" research benchmarks', days: 365 },
  { category: "demand_gen",      asset_type: "whitepaper", query: 'demand generation whitepaper B2B benchmarks 2026', days: 365 },
  { category: "buyer_signals",   asset_type: "whitepaper", query: 'intent data whitepaper Bombora 6sense Demandbase benchmarks', days: 365 },
  { category: "analytics",       asset_type: "whitepaper", query: 'marketing measurement whitepaper attribution Nielsen Forrester', days: 365 },
  { category: "seo",             asset_type: "whitepaper", query: 'SEO whitepaper search ranking factors research 2026', days: 365 },
  { category: "email",           asset_type: "whitepaper", query: 'email marketing whitepaper deliverability benchmark report 2026', days: 365 },
  { category: "strategy",        asset_type: "whitepaper", query: 'B2B marketing whitepaper research strategy 2026', days: 365 },
  { category: "ad_copy",         asset_type: "whitepaper", query: 'advertising effectiveness whitepaper creative testing research', days: 365 },

  // ━━━━━━ PLAYBOOKS (tactical step-by-step) ━━━━━━
  { category: "abm",             asset_type: "playbook", query: '"ABM playbook" tier-1 enterprise tactics steps', days: 180 },
  { category: "demand_gen",      asset_type: "playbook", query: '"demand gen playbook" pipeline tactics B2B 2026', days: 180 },
  { category: "seo",             asset_type: "playbook", query: '"SEO playbook" technical content link building tactics 2026', days: 180 },
  { category: "ad_copy",         asset_type: "playbook", query: '"ad copy playbook" testing Google Ads Meta LinkedIn winning patterns', days: 180 },
  { category: "email",           asset_type: "playbook", query: '"email marketing playbook" sequences nurture cold outreach steps', days: 180 },
  { category: "buyer_signals",   asset_type: "playbook", query: '"signal-based selling playbook" intent triggers tactics', days: 180 },
  { category: "company_signals", asset_type: "playbook", query: '"signal-based marketing playbook" company triggers outreach steps', days: 180 },
  { category: "competitor",      asset_type: "playbook", query: '"competitive battlecard playbook" displacement positioning steps', days: 180 },
  { category: "orm",             asset_type: "playbook", query: '"brand crisis playbook" response strategy steps', days: 365 },
  { category: "analytics",       asset_type: "playbook", query: '"marketing operations playbook" MOPs RevOps tactics 2026', days: 180 },
  { category: "strategy",        asset_type: "playbook", query: '"GTM playbook" product launch positioning steps B2B SaaS', days: 180 },

  // ━━━━━━ CASE STUDIES (customer success with metrics) ━━━━━━
  { category: "abm",             asset_type: "case_study", query: '"ABM case study" B2B SaaS revenue impact metrics 2026', days: 365 },
  { category: "demand_gen",      asset_type: "case_study", query: '"demand generation case study" pipeline pipeline impact metrics', days: 365 },
  { category: "seo",             asset_type: "case_study", query: '"SEO case study" traffic growth ranking results', days: 365 },
  { category: "ad_copy",         asset_type: "case_study", query: '"Google Ads case study" OR "Meta Ads case study" ROAS improvement', days: 365 },
  { category: "email",           asset_type: "case_study", query: '"email marketing case study" open rate CTR conversion lift', days: 365 },
  { category: "buyer_signals",   asset_type: "case_study", query: '"intent data case study" 6sense Bombora pipeline impact', days: 365 },
  { category: "company_signals", asset_type: "case_study", query: '"signal-based outbound case study" reply rate meetings booked', days: 365 },
  { category: "orm",             asset_type: "case_study", query: '"brand reputation case study" crisis response Trustpilot G2', days: 365 },
  { category: "analytics",       asset_type: "case_study", query: '"marketing attribution case study" multi-touch MMM ROI', days: 365 },
  { category: "competitor",      asset_type: "case_study", query: '"win-loss analysis case study" displacement competitive marketing', days: 365 },
  { category: "strategy",        asset_type: "case_study", query: '"GTM case study" product launch B2B SaaS results', days: 365 },

  // ━━━━━━ SOCIAL POSTS (LinkedIn / X viral marketing) ━━━━━━
  { category: "ad_copy",         asset_type: "social_post", query: 'LinkedIn post viral B2B marketing ad copy hooks 2026', days: 60 },
  { category: "demand_gen",      asset_type: "social_post", query: 'LinkedIn marketing leader posts demand gen growth 2026', days: 30 },
  { category: "abm",             asset_type: "social_post", query: 'LinkedIn ABM tactical post marketing leadership 2026', days: 60 },
  { category: "trend",           asset_type: "social_post", query: 'LinkedIn viral marketing post trend B2B 2026', days: 30 },
  { category: "seo",             asset_type: "social_post", query: 'LinkedIn SEO marketing post tactical thread 2026', days: 60 },
  { category: "strategy",        asset_type: "social_post", query: 'LinkedIn marketing strategy thread viral B2B 2026', days: 30 },
  { category: "analytics",       asset_type: "social_post", query: 'LinkedIn marketing analytics attribution post viral 2026', days: 60 },
  { category: "buyer_signals",   asset_type: "social_post", query: 'LinkedIn intent data buyer signals post B2B sales 2026', days: 60 },

  // ━━━━━━ AD CAMPAIGNS (creative breakdowns, campaign analyses) ━━━━━━
  { category: "ad_copy",         asset_type: "ad_campaign", query: '"best ad campaigns 2026" creative breakdown analysis', days: 180 },
  { category: "ad_copy",         asset_type: "ad_campaign", query: 'Super Bowl 2026 ads creative analysis ROI', days: 180 },
  { category: "ad_copy",         asset_type: "ad_campaign", query: 'B2B SaaS ad campaign teardown copy creative analysis', days: 180 },
  { category: "ad_copy",         asset_type: "ad_campaign", query: 'TikTok ad campaign viral creative breakdown 2026', days: 90 },
  { category: "ad_copy",         asset_type: "ad_campaign", query: 'LinkedIn ad campaign B2B sponsored content creative analysis', days: 180 },
  { category: "ad_copy",         asset_type: "ad_campaign", query: 'retail media ad campaign Amazon Walmart sponsored ads case study', days: 180 },
  { category: "trend",           asset_type: "ad_campaign", query: '"campaign of the year" 2026 marketing advertising', days: 365 },

  // ━━━━━━ REPORTS (Gartner / Forrester / McKinsey style) ━━━━━━
  { category: "trend",           asset_type: "report", query: 'Gartner CMO Spend Survey 2026 marketing budget research', days: 365 },
  { category: "abm",             asset_type: "report", query: 'Forrester ABM benchmark report 2026 enterprise marketing', days: 365 },
  { category: "demand_gen",      asset_type: "report", query: 'Pipeline benchmark report B2B SaaS marketing 2026', days: 365 },
  { category: "analytics",       asset_type: "report", query: 'marketing attribution report MMM MTA benchmark 2026', days: 365 },
  { category: "buyer_signals",   asset_type: "report", query: 'intent data adoption report B2B sales marketing 2026', days: 365 },
  { category: "seo",             asset_type: "report", query: 'SEO industry report ranking factors research 2026', days: 365 },
  { category: "email",           asset_type: "report", query: 'email marketing benchmark report open CTR deliverability 2026', days: 365 },
  { category: "strategy",        asset_type: "report", query: 'B2B marketing maturity model report Forrester research', days: 365 },
  { category: "orm",             asset_type: "report", query: 'consumer trust brand reputation report Edelman 2026', days: 365 },

  // ━━━━━━ NEWSLETTERS (Morning Brew, TLDR Marketing, MarketingProfs) ━━━━━━
  { category: "trend",           asset_type: "newsletter", query: 'Marketing Brew newsletter top stories this week', days: 7 },
  { category: "ad_copy",         asset_type: "newsletter", query: 'TLDR Marketing newsletter ad campaigns this week', days: 7 },
  { category: "demand_gen",      asset_type: "newsletter", query: 'Morning Brew marketing newsletter B2B demand gen 2026', days: 14 },
  { category: "seo",             asset_type: "newsletter", query: 'Search Engine Roundtable newsletter SEO updates this week', days: 7 },

  // ━━━━━━ PODCASTS (show notes / transcripts) ━━━━━━
  { category: "demand_gen",      asset_type: "podcast", query: 'B2B demand gen podcast Pavilion CRO show notes 2026', days: 60 },
  { category: "abm",             asset_type: "podcast", query: 'ABM podcast Demandbase 6sense show notes 2026', days: 60 },
  { category: "seo",             asset_type: "podcast", query: 'SEO podcast Search Engine Journal show notes 2026', days: 60 },
  { category: "ad_copy",         asset_type: "podcast", query: 'copywriting podcast direct response marketing show notes', days: 90 },

  // ━━━━━━ VIDEO / WEBINAR ━━━━━━
  { category: "abm",             asset_type: "video", query: 'ABM webinar replay B2B marketing tactics 2026 transcript', days: 90 },
  { category: "demand_gen",      asset_type: "video", query: 'demand gen webinar transcript B2B SaaS 2026', days: 90 },
  { category: "buyer_signals",   asset_type: "video", query: 'intent data webinar transcript Bombora 6sense 2026', days: 90 },

  // ━━━━━━ TEMPLATES & FRAMEWORKS ━━━━━━
  { category: "ad_copy",         asset_type: "template", query: '"ad copy template" "Google Ads template" download', days: 365 },
  { category: "email",           asset_type: "template", query: '"email template" sequence cold outreach download', days: 365 },
  { category: "abm",             asset_type: "template", query: '"ABM template" account plan tier-1 download', days: 365 },
  { category: "demand_gen",      asset_type: "template", query: '"demand gen template" campaign plan brief download', days: 365 },
  { category: "strategy",        asset_type: "template", query: '"GTM template" positioning canvas StoryBrand download', days: 365 },
  { category: "analytics",       asset_type: "template", query: '"marketing dashboard template" Looker GA4 KPI download', days: 365 },
  { category: "competitor",      asset_type: "template", query: '"battlecard template" competitive analysis download', days: 365 },

  // ━━━━━━ GUIDES (long-form how-to) ━━━━━━
  { category: "aeo_geo",         asset_type: "guide", query: '"complete guide" AEO GEO LLMO AI search citations 2026', days: 180 },
  { category: "buyer_signals",   asset_type: "guide", query: '"complete guide" intent data signal-based selling B2B 2026', days: 180 },
  { category: "orm",             asset_type: "guide", query: '"complete guide" online reputation management brand monitoring', days: 365 },
  { category: "company_signals", asset_type: "guide", query: '"guide" company signal triggers hiring funding B2B sales', days: 180 },
];

async function tavilySearch(query: string, apiKey: string, opts: { days: number; topic: "news" | "general" }): Promise<TavilyResponse | null> {
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
        topic: opts.topic,
        days: opts.days,
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

  // Allow slicing for parallel cron runs (slice=0/1/2/3 for quarters)
  const url = req.nextUrl;
  const slice = url.searchParams.get("slice");
  let topicsForRun = TOPICS;
  if (slice) {
    const totalSlices = 4;
    const sliceIdx = parseInt(slice, 10);
    const size = Math.ceil(TOPICS.length / totalSlices);
    topicsForRun = TOPICS.slice(sliceIdx * size, (sliceIdx + 1) * size);
  }

  const { data: runRow } = await supa
    .from("intel_scrape_runs")
    .insert({ topics_run: topicsForRun.length })
    .select("id")
    .single();
  const runId = runRow?.id;

  let added = 0;
  let skipped = 0;
  const startedAt = Date.now();

  const batchSize = 4;
  for (let i = 0; i < topicsForRun.length; i += batchSize) {
    const batch = topicsForRun.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (t) => {
      const tav = await tavilySearch(t.query, tavilyKey, {
        days: t.days ?? 30,
        topic: t.topic ?? (t.asset_type === "article" || t.asset_type === "social_post" || t.asset_type === "newsletter" ? "news" : "general"),
      });
      if (!tav) return [];
      return tav.results.map((r) => ({
        topic: t.query,
        category: t.category,
        asset_type: t.asset_type,
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
