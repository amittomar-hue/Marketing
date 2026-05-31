import { getSupabase } from "./supabase";
import { Intent } from "./supabase";

interface IntelItem {
  title: string;
  url: string;
  summary: string | null;
  source: string | null;
  scraped_at: string;
}

/**
 * Pull the freshest scraped intel for a given intent / category.
 * Used to inject real-world context into chat responses about trends.
 */
export async function getLatestIntel(
  category: Intent,
  limit = 5,
  windowDays = 14
): Promise<IntelItem[]> {
  const supa = getSupabase();
  if (!supa) return [];

  const since = new Date(Date.now() - windowDays * 86400000).toISOString();

  const { data, error } = await supa
    .from("marketing_intel")
    .select("title, url, summary, source, scraped_at")
    .eq("category", category)
    .gte("scraped_at", since)
    .order("scraped_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getLatestIntel error:", error.message);
    return [];
  }
  return (data ?? []) as IntelItem[];
}

export function formatIntelAsContext(items: IntelItem[], categoryLabel: string): string {
  if (items.length === 0) return "";
  const lines = [
    `Recent scraped intel from the web (category: ${categoryLabel}, last 14 days):`,
    "",
  ];
  items.forEach((item, i) => {
    lines.push(`[I${i + 1}] ${item.title}`);
    lines.push(`Source: ${item.source ?? new URL(item.url).hostname}`);
    lines.push(`URL: ${item.url}`);
    if (item.summary) lines.push(`Excerpt: ${item.summary.slice(0, 400)}`);
    lines.push("");
  });
  lines.push("When relevant, cite these as [I1], [I2], etc. and include the URLs in your Sources section.");
  return lines.join("\n");
}
