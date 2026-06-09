import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { exaSearch, exaToTavily, startDateForRange } from "@/lib/exa";

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
  { category: "seo",             asset_type: "ebook", query: '"SEO ebook" summary OR "complete SEO guide" chapter key takeaways 2026', days: 365 },
  { category: "abm",             asset_type: "ebook", query: '"ABM ebook" account-based marketing summary chapter key takeaways', days: 365 },
  { category: "demand_gen",      asset_type: "ebook", query: '"demand generation ebook" B2B SaaS summary chapter takeaways', days: 365 },
  { category: "ad_copy",         asset_type: "ebook", query: '"copywriting ebook" OR "ad copy ebook" summary chapter excerpt takeaways', days: 365 },
  { category: "email",           asset_type: "ebook", query: '"email marketing ebook" deliverability lifecycle summary key takeaways', days: 365 },
  { category: "analytics",       asset_type: "ebook", query: '"marketing analytics ebook" attribution measurement summary takeaways', days: 365 },
  { category: "strategy",        asset_type: "ebook", query: '"GTM strategy ebook" OR "go-to-market guide" B2B SaaS summary takeaways', days: 365 },
  { category: "buyer_signals",   asset_type: "ebook", query: '"intent data ebook" buyer signals B2B summary key takeaways', days: 365 },
  { category: "orm",             asset_type: "ebook", query: '"brand reputation ebook" online reputation management summary takeaways', days: 365 },
  { category: "competitor",      asset_type: "ebook", query: '"competitive intelligence ebook" win-loss summary chapter takeaways', days: 365 },
  { category: "company_signals", asset_type: "ebook", query: '"signal-based marketing ebook" company triggers summary takeaways 2026', days: 365 },

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
  { category: "abm",             asset_type: "playbook", query: '"ABM playbook" tier-1 enterprise tactics steps 2026', days: 180 },
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

  // ━━━━━━ SOCIAL POSTS ━━━━━━
  { category: "ad_copy",         asset_type: "social_post", query: 'viral LinkedIn post breakdown hook structure marketing analysis', days: 90, topic: "general" },
  { category: "ad_copy",         asset_type: "social_post", query: '"best LinkedIn posts" examples B2B marketing 2026 teardown', days: 90 },
  { category: "demand_gen",      asset_type: "social_post", query: 'LinkedIn growth post analysis demand gen leader examples', days: 90 },
  { category: "trend",           asset_type: "social_post", query: 'X Twitter viral marketing post examples 2026 analysis', days: 90 },
  { category: "seo",             asset_type: "social_post", query: 'high-engagement LinkedIn SEO thread example breakdown', days: 90 },
  { category: "strategy",        asset_type: "social_post", query: 'viral marketing thread structure hook examples 2026', days: 90 },
  { category: "ad_copy",         asset_type: "social_post", query: 'LinkedIn ad creative organic post viral examples B2B marketing analysis 2026', days: 60 },
  { category: "buyer_signals",   asset_type: "social_post", query: 'sales LinkedIn post examples intent data B2B leaders breakdown', days: 90 },

  // ━━━━━━ AD CAMPAIGNS ━━━━━━
  { category: "ad_copy",         asset_type: "ad_campaign", query: '"ad teardown" 2026 OR "campaign teardown" B2B SaaS marketing', days: 180 },
  { category: "ad_copy",         asset_type: "ad_campaign", query: '"creative breakdown" Meta Facebook ads 2026 marketing analysis', days: 180 },
  { category: "ad_copy",         asset_type: "ad_campaign", query: 'Super Bowl 2026 ads creative analysis ROI behind-the-scenes', days: 365 },
  { category: "ad_copy",         asset_type: "ad_campaign", query: 'B2B SaaS ad campaign breakdown hook insight creative analysis 2026', days: 180 },
  { category: "ad_copy",         asset_type: "ad_campaign", query: 'TikTok ad viral campaign creative analysis breakdown 2026', days: 90 },
  { category: "ad_copy",         asset_type: "ad_campaign", query: 'LinkedIn ads B2B campaign analysis creative breakdown ROI 2026', days: 180 },
  { category: "ad_copy",         asset_type: "ad_campaign", query: 'retail media Amazon Walmart sponsored ads campaign analysis 2026', days: 180 },
  { category: "trend",           asset_type: "ad_campaign", query: '"best ad campaigns" 2026 marketing advertising effectiveness breakdown', days: 365 },
  { category: "trend",           asset_type: "ad_campaign", query: 'Cannes Lions 2026 winning campaigns analysis creative effectiveness', days: 365 },

  // ━━━━━━ REPORTS ━━━━━━
  { category: "trend",           asset_type: "report", query: 'Gartner CMO Spend Survey 2026 marketing budget research', days: 365 },
  { category: "abm",             asset_type: "report", query: 'Forrester ABM benchmark report 2026 enterprise marketing', days: 365 },
  { category: "demand_gen",      asset_type: "report", query: 'Pipeline benchmark report B2B SaaS marketing 2026', days: 365 },
  { category: "analytics",       asset_type: "report", query: 'marketing attribution report MMM MTA benchmark 2026', days: 365 },
  { category: "buyer_signals",   asset_type: "report", query: 'intent data adoption report B2B sales marketing 2026', days: 365 },
  { category: "seo",             asset_type: "report", query: 'SEO industry report ranking factors research 2026', days: 365 },
  { category: "email",           asset_type: "report", query: 'email marketing benchmark report open CTR deliverability 2026', days: 365 },
  { category: "strategy",        asset_type: "report", query: 'B2B marketing maturity model report Forrester research', days: 365 },
  { category: "orm",             asset_type: "report", query: 'consumer trust brand reputation report Edelman 2026', days: 365 },

  // ━━━━━━ NEWSLETTERS ━━━━━━
  { category: "trend",           asset_type: "newsletter", query: '"this week in marketing" recap top stories 2026', days: 14, topic: "news" },
  { category: "trend",           asset_type: "newsletter", query: 'marketing newsletter recap weekly B2B SaaS trends 2026', days: 14, topic: "news" },
  { category: "ad_copy",         asset_type: "newsletter", query: 'advertising newsletter recap weekly ad campaigns 2026', days: 14 },
  { category: "demand_gen",      asset_type: "newsletter", query: 'demand gen newsletter weekly B2B SaaS recap', days: 14, topic: "news" },
  { category: "seo",             asset_type: "newsletter", query: 'SEO newsletter weekly recap algorithm updates 2026', days: 14, topic: "news" },
  { category: "analytics",       asset_type: "newsletter", query: 'marketing analytics newsletter weekly attribution recap 2026', days: 14 },
  { category: "company_signals", asset_type: "newsletter", query: 'B2B marketing newsletter funding hiring company signals 2026', days: 14, topic: "news" },

  // ━━━━━━ PODCASTS ━━━━━━
  { category: "demand_gen",      asset_type: "podcast", query: '"podcast episode" demand gen B2B SaaS Pavilion show notes 2026', days: 180 },
  { category: "abm",             asset_type: "podcast", query: '"podcast episode" ABM Demandbase 6sense show notes 2026', days: 180 },
  { category: "seo",             asset_type: "podcast", query: '"podcast episode" SEO Search Engine Journal show notes 2026', days: 180 },
  { category: "ad_copy",         asset_type: "podcast", query: '"podcast episode" copywriting direct response marketing show notes', days: 180 },
  { category: "strategy",        asset_type: "podcast", query: '"podcast episode" marketing strategy CMO leader show notes 2026', days: 180 },
  { category: "buyer_signals",   asset_type: "podcast", query: '"podcast episode" intent data buyer signals B2B sales show notes', days: 180 },
  { category: "analytics",       asset_type: "podcast", query: '"podcast episode" marketing attribution analytics show notes 2026', days: 180 },

  // ━━━━━━ VIDEO / WEBINAR ━━━━━━
  { category: "abm",             asset_type: "video", query: '"webinar recap" ABM B2B marketing tactics 2026 takeaways', days: 180 },
  { category: "demand_gen",      asset_type: "video", query: '"webinar summary" demand gen B2B SaaS 2026 takeaways', days: 180 },
  { category: "buyer_signals",   asset_type: "video", query: '"webinar recap" intent data Bombora 6sense 2026 takeaways', days: 180 },
  { category: "seo",             asset_type: "video", query: '"webinar recap" SEO algorithm updates 2026 takeaways', days: 180 },
  { category: "analytics",       asset_type: "video", query: '"webinar summary" marketing attribution analytics 2026 takeaways', days: 180 },
  { category: "ad_copy",         asset_type: "video", query: '"webinar recap" advertising copy creative B2B SaaS 2026 takeaways', days: 180 },

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

// Asset types with sparse hit rates get a larger Tavily window.
const SPARSE_ASSET_TYPES = new Set<AssetType>([
  "social_post", "ad_campaign", "newsletter", "podcast", "video", "ebook", "playbook",
]);

// Path B (Tavily free-tier safe): no ?slice= param? Then auto-rotate
// based on day-of-year so the full TOPICS list cycles across multiple
// days. Math:
//   130 queries / 9 slices ≈ 14 queries/day
//   14 × 2 credits (advanced) × 30 days = 840 credits/month
//   (fits inside 1,000 free quota with 16% headroom)
// Each topic gets revisited ~3-4 times per month.
const AUTO_ROTATE_SLICES = 9;

// Diagnostic state: first failure per scrape run, per provider, gets
// stashed here so the route response surfaces the real error from each
// side instead of silently returning null. Resets at the start of every
// run via the GET handler.
const exaDiag: { status?: number; statusText?: string; body?: string; error?: string } = {};
const tavilyDiag: { status?: number; statusText?: string; body?: string; error?: string } = {};
// Per-run counter for which provider actually served each topic. The
// route response includes these so we can see at a glance whether Exa
// is healthy or if Tavily is silently absorbing all traffic.
const providerCounts: { exa: number; tavily: number } = { exa: 0, tavily: 0 };
// Per-run counter for whether each successful Exa call came from the
// authority-domain-filtered pass or the unrestricted fallback pass.
// Ratio of authority:unrestricted is the quality signal — if most
// topics fall back to unrestricted, the authority list is too narrow
// for the current topic mix.
const sourceQualityCounts: { authority: number; unrestricted: number } = { authority: 0, unrestricted: 0 };

// ─────────────────────────────────────────────────────────────────
// Authority-domain allow-list per asset_type. Drives the primary
// Exa pass: when a topic asks for e.g. a `report`, only Gartner /
// Forrester / McKinsey-tier publishers count. If that yields zero
// results, the route falls back to an unrestricted Exa pass so the
// corpus still grows. Asset types sourced from social platforms
// (social_post, podcast, video, ad_campaign) are intentionally
// absent — domain-gating those would zero them out.
//
// Pruning guidance: if you add a domain here, keep it to publishers
// with editorial review or analyst credentials. Treat the list as a
// quality signal, not a relevance one — broad coverage isn't the
// goal; high per-article training-pair quality is.
// ─────────────────────────────────────────────────────────────────
const AUTHORITY_DOMAINS: Partial<Record<AssetType, string[]>> = {
  report: [
    "gartner.com", "forrester.com", "mckinsey.com", "bcg.com", "bain.com",
    "deloitte.com", "accenture.com", "kpmg.com", "ey.com", "pwc.com",
    "emarketer.com", "statista.com", "idc.com", "iab.com", "edelman.com",
  ],
  whitepaper: [
    "gartner.com", "forrester.com", "mckinsey.com", "bcg.com", "bain.com",
    "deloitte.com", "accenture.com", "hubspot.com", "salesforce.com",
    "adobe.com", "oracle.com", "ibm.com", "microsoft.com",
  ],
  case_study: [
    "hbr.org", "mitsloan.mit.edu", "knowledge.wharton.upenn.edu", "hbs.edu",
    "mckinsey.com", "bcg.com", "deloitte.com",
    "salesforce.com", "hubspot.com", "adobe.com", "marketo.com",
    "drift.com", "intercom.com", "gong.io", "6sense.com", "demandbase.com",
  ],
  article: [
    "hbr.org", "mitsloan.mit.edu", "knowledge.wharton.upenn.edu",
    "adage.com", "marketingweek.com", "campaignlive.com", "marketingdive.com",
    "wsj.com", "ft.com", "economist.com", "bloomberg.com", "businessinsider.com",
    "techcrunch.com", "theverge.com", "wired.com",
  ],
  playbook: [
    "hubspot.com", "salesforce.com", "marketo.com", "drift.com", "intercom.com",
    "demandcurve.com", "reforge.com", "lennysnewsletter.com",
    "firstround.com", "a16z.com", "openviewpartners.com",
  ],
  guide: [
    "hubspot.com", "salesforce.com", "ahrefs.com", "moz.com", "semrush.com",
    "backlinko.com", "searchengineland.com", "searchenginejournal.com",
    "marketingprofs.com", "contentmarketinginstitute.com",
  ],
  ebook: [
    "hubspot.com", "salesforce.com", "gartner.com", "forrester.com",
    "marketo.com", "adobe.com", "oracle.com", "marketingprofs.com",
  ],
  newsletter: [
    "lennysnewsletter.com", "morningbrew.com", "tldr.tech", "marketingbrew.com",
    "theinformation.com", "axios.com", "stratechery.com",
  ],
  template: [
    "hubspot.com", "salesforce.com", "marketo.com", "smartsheet.com",
    "asana.com", "monday.com", "notion.so", "airtable.com",
  ],
  // Intentionally NOT gated — sourced from social platforms or hard
  // to allow-list cleanly:
  //   social_post, ad_campaign, podcast, video
};

async function tavilyDirect(
  query: string,
  apiKey: string,
  opts: { days: number; topic: "news" | "general"; assetType: AssetType }
): Promise<TavilyResponse | null> {
  try {
    const maxResults = SPARSE_ASSET_TYPES.has(opts.assetType) ? 10 : 5;
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        include_answer: false,
        max_results: maxResults,
        topic: opts.topic,
        days: opts.days,
      }),
    });
    if (!res.ok) {
      if (!tavilyDiag.status) {
        tavilyDiag.status = res.status;
        tavilyDiag.statusText = res.statusText;
        tavilyDiag.body = (await res.text().catch(() => "")).slice(0, 300);
      }
      return null;
    }
    return await res.json();
  } catch (e) {
    if (!tavilyDiag.error) {
      tavilyDiag.error = e instanceof Error ? e.message : String(e);
    }
    return null;
  }
}

// Dual-provider search with quality-curation pass:
//   1. Exa filtered to AUTHORITY_DOMAINS for this asset_type (Gartner,
//      Forrester, HBR, McKinsey, etc) — highest signal training data.
//   2. If pass 1 returns 0 results, Exa unrestricted — quality drops
//      but corpus keeps growing.
//   3. If Exa fails entirely, Tavily — last-resort fallback.
// Both providers' first failure is captured into their diag objects so
// the cron's JSON response shows exactly which side broke and how.
async function tavilySearch(
  query: string,
  tavilyKey: string | undefined,
  opts: { days: number; topic: "news" | "general"; assetType: AssetType }
): Promise<TavilyResponse | null> {
  const exaKey = process.env.EXA_API_KEY;
  const maxResults = SPARSE_ASSET_TYPES.has(opts.assetType) ? 10 : 5;
  const authorityList = AUTHORITY_DOMAINS[opts.assetType];

  // PRIMARY: Exa with authority-domain allow-list (if defined for this asset_type)
  if (exaKey) {
    try {
      if (authorityList && authorityList.length > 0) {
        const filtered = await exaSearch(query, exaKey, {
          numResults: maxResults,
          startPublishedDate: startDateForRange(undefined, opts.days),
          type: "auto",
          includeDomains: authorityList,
        });
        if (filtered.results.length > 0) {
          providerCounts.exa += 1;
          sourceQualityCounts.authority += 1;
          return exaToTavily(query, filtered);
        }
        // Filtered pass returned nothing — try unrestricted before giving up.
      }
      const unrestricted = await exaSearch(query, exaKey, {
        numResults: maxResults,
        startPublishedDate: startDateForRange(undefined, opts.days),
        type: "auto",
      });
      if (unrestricted.results.length > 0) {
        providerCounts.exa += 1;
        sourceQualityCounts.unrestricted += 1;
        return exaToTavily(query, unrestricted);
      }
      if (!exaDiag.body) exaDiag.body = "Exa returned 0 results (both filtered and unrestricted)";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!exaDiag.error) exaDiag.error = msg;
      // Parse "Exa error 429: ..." to surface the status code separately.
      const m = msg.match(/Exa error (\d+):/);
      if (m && !exaDiag.status) exaDiag.status = parseInt(m[1], 10);
    }
  }

  // FALLBACK: Tavily
  if (!tavilyKey) return null;
  const result = await tavilyDirect(query, tavilyKey, opts);
  if (result) providerCounts.tavily += 1;
  return result;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron && process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tavilyKey = process.env.TAVILY_API_KEY;
  const exaKey = process.env.EXA_API_KEY;
  if (!exaKey && !tavilyKey) {
    return NextResponse.json(
      { error: "Both EXA_API_KEY and TAVILY_API_KEY missing — no search provider available" },
      { status: 503 }
    );
  }

  // Reset per-run diagnostic state so a previous run's failures don't
  // leak into this run's response payload.
  delete exaDiag.status;    delete exaDiag.statusText;    delete exaDiag.body;    delete exaDiag.error;
  delete tavilyDiag.status; delete tavilyDiag.statusText; delete tavilyDiag.body; delete tavilyDiag.error;
  providerCounts.exa = 0;
  providerCounts.tavily = 0;
  sourceQualityCounts.authority = 0;
  sourceQualityCounts.unrestricted = 0;

  const supa = getSupabase();
  if (!supa) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  // Slicing strategy:
  // - ?slice=N (0..AUTO_ROTATE_SLICES-1) — explicit, used for manual triggers
  //   or staged rollout. Falls back to slice=0 if out of range.
  // - No ?slice param — AUTO-ROTATE: pick the slice based on day-of-year
  //   modulo AUTO_ROTATE_SLICES. Cycles through the entire TOPICS list
  //   across 9 daily runs. Fits Tavily's 1,000 credits/month free quota
  //   (≈14 queries/day × 2 credits × 30 days = 840 credits).
  const url = req.nextUrl;
  const sliceParam = url.searchParams.get("slice");
  const allTopicsFlag = url.searchParams.get("all") === "1";
  const size = Math.ceil(TOPICS.length / AUTO_ROTATE_SLICES);
  let sliceIdx: number;
  let topicsForRun: typeof TOPICS;
  if (allTopicsFlag) {
    sliceIdx = -1;
    topicsForRun = TOPICS;
  } else if (sliceParam !== null) {
    sliceIdx = Math.max(0, Math.min(AUTO_ROTATE_SLICES - 1, parseInt(sliceParam, 10) || 0));
    topicsForRun = TOPICS.slice(sliceIdx * size, (sliceIdx + 1) * size);
  } else {
    // Auto-rotate by day-of-year — every UTC day picks the next slice.
    const now = new Date();
    const start = Date.UTC(now.getUTCFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start) / 86400000);
    sliceIdx = dayOfYear % AUTO_ROTATE_SLICES;
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
        assetType: t.asset_type,
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
    topics_total: TOPICS.length,
    slice_idx: sliceIdx,
    slice_size: topicsForRun.length,
    auto_rotate_slices: AUTO_ROTATE_SLICES,
    items_added: added,
    items_skipped: skipped,
    duration_ms: Date.now() - startedAt,
    // Dual-provider visibility — at a glance: which provider served each
    // topic, whether keys are set, and the FIRST failure per provider.
    provider_counts: providerCounts,
    // Quality-curation visibility — ratio of topics served by the
    // authority-domain-filtered Exa pass vs the unrestricted fallback.
    // Higher authority:unrestricted ratio = corpus skews to high-signal
    // publishers. If unrestricted dominates, the AUTHORITY_DOMAINS list
    // is too narrow for the topics being scraped that day.
    source_quality_counts: sourceQualityCounts,
    exa_key_set: !!exaKey,
    exa_first_failure: Object.keys(exaDiag).length ? exaDiag : null,
    tavily_key_set: !!tavilyKey,
    tavily_key_prefix: tavilyKey?.slice(0, 6) ?? null,
    tavily_first_failure: Object.keys(tavilyDiag).length ? tavilyDiag : null,
  });
}
