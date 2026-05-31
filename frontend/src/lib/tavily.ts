export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilyResponse {
  answer?: string;
  query: string;
  results: TavilyResult[];
}

export async function tavilySearch(query: string): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      include_answer: true,
      max_results: 4,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Tavily error ${res.status}: ${txt.slice(0, 200)}`);
  }

  return (await res.json()) as TavilyResponse;
}

export function formatTavilyForContext(r: TavilyResponse): string {
  const lines = [
    `Web search results for: "${r.query}"`,
    "",
  ];
  if (r.answer) {
    lines.push("Direct answer summary:");
    lines.push(r.answer);
    lines.push("");
  }
  lines.push("Top sources:");
  r.results.forEach((res, i) => {
    lines.push(`\n[${i + 1}] ${res.title}`);
    lines.push(`URL: ${res.url}`);
    lines.push(`Excerpt: ${res.content.slice(0, 500)}`);
  });
  return lines.join("\n");
}
