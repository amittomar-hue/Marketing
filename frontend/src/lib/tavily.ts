export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export interface TavilyResponse {
  answer?: string;
  query: string;
  results: TavilyResult[];
}

export interface TavilySearchOptions {
  /** "news" for time-sensitive queries; "general" for evergreen */
  topic?: "news" | "general";
  /** Restrict freshness: "day" | "week" | "month" | "year" */
  timeRange?: "day" | "week" | "month" | "year";
  /** Override how many results to return (default 8) */
  maxResults?: number;
}

// Lightweight signals that the query is news-y / time-sensitive. When true we
// switch Tavily to topic="news" + tight time_range, which surfaces fresher,
// higher-recency content than the default "general" mode.
function isFreshnessSensitive(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\b(20\d{2}|today|this week|this month|right now|latest|recent|breaking|news|trend|update|launch|just announced|q[1-4])\b/.test(q) ||
    /\b(best|top)\s+(of|for)?\s*20\d{2}\b/.test(q)
  );
}

// ─────────────────────────────────────────────────────────────────
// Dual-provider search: Exa primary, Tavily fallback.
//
// Why this shape: Tavily's quota wall left the corpus frozen for 3+
// days in June 2026. Going single-vendor on Exa would just reproduce
// the same failure mode under a different brand. Pattern below tries
// Exa first (fresh quota, better neural ranking) and falls through
// to Tavily on any error — quota, timeout, malformed response. When
// Tavily resets, it sits idle as backup; if Exa hits its own wall,
// Tavily quietly takes over.
//
// Function name kept as `tavilySearch` so existing callers don't
// need to change — the chat route already imports it. The export
// `searchWithFallback` is the same function under a more honest name.
// ─────────────────────────────────────────────────────────────────

import { exaSearch, exaToTavily, startDateForRange } from "./exa";

async function tavilySearchDirect(
  query: string,
  opts: TavilySearchOptions
): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const fresh = isFreshnessSensitive(query);
  const topic = opts.topic ?? (fresh ? "news" : "general");
  const timeRange = opts.timeRange ?? (fresh ? "month" : "year");
  const maxResults = opts.maxResults ?? 8;

  const body: Record<string, unknown> = {
    api_key: apiKey,
    query,
    search_depth: "advanced",
    include_answer: "advanced",
    max_results: maxResults,
    topic,
    time_range: timeRange,
  };
  if (topic === "news") body.days = 60;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Tavily error ${res.status}: ${txt.slice(0, 200)}`);
  }

  return (await res.json()) as TavilyResponse;
}

export async function tavilySearch(
  query: string,
  opts: TavilySearchOptions = {}
): Promise<TavilyResponse> {
  const exaKey = process.env.EXA_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;

  // PRIMARY: Exa. Fresh quota, returns excerpts inline like Tavily.
  if (exaKey) {
    try {
      const fresh = isFreshnessSensitive(query);
      const timeRange = opts.timeRange ?? (fresh ? "month" : "year");
      const exa = await exaSearch(query, exaKey, {
        numResults: opts.maxResults ?? 8,
        startPublishedDate: startDateForRange(timeRange),
        type: "auto",
      });
      // Empty results from Exa = treat as failure so Tavily can try.
      if (exa.results.length > 0) return exaToTavily(query, exa);
    } catch (e) {
      console.warn(
        "[search] Exa failed, falling back to Tavily:",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  // FALLBACK: Tavily. Only here if Exa missing / errored / empty.
  if (!tavilyKey) {
    throw new Error(
      "No search provider available: both EXA_API_KEY and TAVILY_API_KEY are missing"
    );
  }
  return tavilySearchDirect(query, opts);
}

/** Alias for callers that prefer naming honesty about the dual-provider behavior. */
export const searchWithFallback = tavilySearch;

export function formatTavilyForContext(r: TavilyResponse): string {
  const lines = [
    `═══ Live web research for: "${r.query}" ═══`,
    `(Use these as authoritative current sources. Cite inline as [1], [2], etc.`,
    ` and include a "Sources" section at the END of your answer.)`,
    "",
  ];
  if (r.answer) {
    lines.push("**Synthesized answer from search:**");
    lines.push(r.answer);
    lines.push("");
  }
  lines.push(`**Top ${r.results.length} sources** (newest-first where dated):`);
  r.results.forEach((res, i) => {
    lines.push("");
    lines.push(`[${i + 1}] ${res.title}`);
    if (res.published_date) lines.push(`   published: ${res.published_date}`);
    lines.push(`   url: ${res.url}`);
    // Bigger excerpt (800 chars) so the model has real material to ground on
    lines.push(`   excerpt: ${(res.content ?? "").slice(0, 800)}`);
  });
  return lines.join("\n");
}
