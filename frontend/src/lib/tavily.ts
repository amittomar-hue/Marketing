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

export async function tavilySearch(
  query: string,
  opts: TavilySearchOptions = {}
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
  // Tavily's "news" topic supports a `days` window — use 60d for news mode
  // to balance freshness vs. recall.
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
