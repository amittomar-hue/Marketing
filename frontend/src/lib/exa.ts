// ─────────────────────────────────────────────────────────────────
// Exa Search client. Used as the PRIMARY search provider — Tavily
// stays around as a fallback when Exa fails (quota, outage, etc).
//
// Exa returns results in a slightly different shape than Tavily:
//   - Exa: { results: [{ title, url, text, score, publishedDate }] }
//   - Tavily: { results: [{ title, url, content, score, published_date }] }
//
// `exaToTavily()` normalises Exa's response into Tavily's shape so
// every existing caller (chat route's formatTavilyForContext, the cron
// route's row builder) keeps working without changes.
// ─────────────────────────────────────────────────────────────────

import type { TavilyResponse } from "./tavily";

export interface ExaResult {
  title: string | null;
  url: string;
  text?: string;
  score?: number;
  publishedDate?: string;
  author?: string;
}

export interface ExaResponse {
  results: ExaResult[];
}

export interface ExaSearchOptions {
  /** Number of results to return. Exa defaults to 10. */
  numResults?: number;
  /** Restrict to articles published after this ISO date string. */
  startPublishedDate?: string;
  /** auto = Exa picks neural vs keyword; neural = semantic; keyword = lexical. */
  type?: "auto" | "neural" | "keyword";
  /** Max chars of article body to return per result (default 1500). */
  maxCharacters?: number;
}

export async function exaSearch(
  query: string,
  apiKey: string,
  opts: ExaSearchOptions = {}
): Promise<ExaResponse> {
  const body: Record<string, unknown> = {
    query,
    type: opts.type ?? "auto",
    numResults: opts.numResults ?? 8,
    // contents.text returns the article body inline so we don't need
    // a second /contents call — matches Tavily's all-in-one shape.
    contents: { text: { maxCharacters: opts.maxCharacters ?? 1500 } },
  };
  if (opts.startPublishedDate) body.startPublishedDate = opts.startPublishedDate;

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Exa error ${res.status}: ${txt.slice(0, 200)}`);
  }

  return (await res.json()) as ExaResponse;
}

/** Map Exa's response to the TavilyResponse shape that existing
 *  callers already know how to consume. */
export function exaToTavily(query: string, exa: ExaResponse): TavilyResponse {
  return {
    query,
    results: exa.results.map((r) => ({
      title: r.title ?? "(no title)",
      url: r.url,
      content: r.text ?? "",
      score: r.score ?? 0,
      published_date: r.publishedDate,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────
// Helper for converting Tavily's "month" / "year" time-range into
// Exa's startPublishedDate ISO string. Centralised so the chat and
// cron callers don't each implement it.
// ─────────────────────────────────────────────────────────────────
export function startDateForRange(
  range: "day" | "week" | "month" | "year" | undefined,
  fallbackDays?: number
): string | undefined {
  const days =
    range === "day" ? 1 :
    range === "week" ? 7 :
    range === "month" ? 30 :
    range === "year" ? 365 :
    fallbackDays;
  if (days === undefined) return undefined;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
