import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const INTENTS = [
  "ad_copy",
  "trend",
  "email",
  "strategy",
  "competitor",
  "brand_voice",
  "seo",
  "aeo_geo",
  "abm",
  "buyer_signals",
  "company_signals",
  "orm",
  "demand_gen",
  "analytics",
  "lifecycle",
  "general",
] as const;

export type Intent = (typeof INTENTS)[number];

export function classifyIntent(text: string): Intent {
  const t = text.toLowerCase();
  // Search ecosystem
  if (/\b(aeo|answer engine|ai overview|sge|perplexity|citations? in ai|cited by chatgpt|featured snippet)\b/.test(t)) return "aeo_geo";
  if (/\b(geo|generative engine|llmo|ai citations|chatgpt visibility|claude visibility|gemini visibility)\b/.test(t)) return "aeo_geo";
  if (/\b(seo|search engine|keyword|backlinks?|serps?|google rank|technical seo|schema markup|core web vitals|programmatic seo)\b/.test(t)) return "seo";
  // ABM
  if (/\b(abm|account.based|target accounts?|tier.?1|tier.?2|account plan|multi.?thread)\b/.test(t)) return "abm";
  // Signals
  if (/\b(buyer signal|intent data|buying intent|lead scoring|bombora|6sense|demandbase|propensity)\b/.test(t)) return "buyer_signals";
  if (/\b(company signal|firmographic|technographic|hiring trend|funding signal|tech stack change|leadership move)\b/.test(t)) return "company_signals";
  // ORM
  if (/\b(orm|reputation|sentiment|review|brand mention|crisis|defamation|wikipedia)\b/.test(t)) return "orm";
  // Demand / pipeline
  if (/\b(demand gen|pipeline|funnel|attribution|cac|ltv|mmm|mta|incrementality|partner|referral)\b/.test(t)) return "demand_gen";
  // Analytics / ops
  if (/\b(analytics|dashboard|kpi|martech|marketing ops|cdp|data quality|lead routing|gdpr|ccpa)\b/.test(t)) return "analytics";
  // Lifecycle / customer
  if (/\b(onboarding|activation|retention|nps|csat|customer journey|advocacy|expansion|case study)\b/.test(t)) return "lifecycle";
  // Existing
  if (/\b(ad copy|ads?|headline|google ads|meta ads|linkedin ads|tiktok ads?)\b/.test(t)) return "ad_copy";
  if (/\b(trend|trending|whats hot|whats new|emerging)\b/.test(t)) return "trend";
  if (/\b(email|subject line|sequence|newsletter|drip)\b/.test(t)) return "email";
  if (/\b(strategy|gtm|launch|positioning|roadmap|plan|jtbd|storybrand)\b/.test(t)) return "strategy";
  if (/\b(competitor|competit|alternative|vs\.|rival|teardown|win.loss)\b/.test(t)) return "competitor";
  if (/\b(brand voice|tone|on.brand|style guide|copy edit)\b/.test(t)) return "brand_voice";
  return "general";
}
