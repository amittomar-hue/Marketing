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
  "general",
] as const;

export type Intent = (typeof INTENTS)[number];

export function classifyIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (/\b(ad copy|ads?|headline|google ads|meta ads|linkedin ads)\b/.test(t)) return "ad_copy";
  if (/\b(trend|trending|whats hot|whats new|emerging)\b/.test(t)) return "trend";
  if (/\b(email|subject line|sequence|newsletter|drip)\b/.test(t)) return "email";
  if (/\b(strategy|gtm|launch|positioning|roadmap|plan)\b/.test(t)) return "strategy";
  if (/\b(competitor|competit|alternative|vs\.|rival)\b/.test(t)) return "competitor";
  if (/\b(brand voice|tone|on-brand|style guide)\b/.test(t)) return "brand_voice";
  return "general";
}
