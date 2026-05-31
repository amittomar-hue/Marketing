import { getSupabase, Intent } from "./supabase";

interface LearningExample {
  id: string;
  intent: string;
  query_summary: string;
  exemplar_response: string;
  score: number;
  similarity?: number;
  rank?: number;
}

interface NegativePattern {
  query_text: string;
  reason: string;
  similarity: number;
}

export async function logInteraction(args: {
  user_query: string;
  intent: Intent;
  response: string;
  model: string;
  web_search_used: boolean;
  session_id?: string;
  user_id?: string;
  user_email?: string;
}): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("interactions")
    .insert(args)
    .select("id")
    .single();
  if (error) {
    console.error("logInteraction error:", error.message);
    return null;
  }
  return data.id as string;
}

/**
 * Smart retrieval: ranks examples by similarity to user query + score + recency.
 * - First tries the user's primary intent.
 * - Falls back to cross-intent search if primary returns nothing.
 * - Marks retrieved examples as used (for analytics).
 */
export async function retrieveExamples(
  intent: Intent,
  query: string,
  limit = 3
): Promise<LearningExample[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  if (!query || query.length < 3) return [];

  // Primary path: same-intent smart ranking
  const { data: primary, error: e1 } = await supabase.rpc(
    "retrieve_learning_examples",
    { p_intent: intent, p_query: query.slice(0, 500), p_limit: limit }
  );

  let examples = (primary as LearningExample[] | null) ?? [];

  // Cross-intent fallback if primary returned nothing or weak matches
  const needFallback =
    examples.length === 0 ||
    examples.every((e) => (e.similarity ?? 0) < 0.15);

  if (needFallback) {
    const { data: broad, error: e2 } = await supabase.rpc(
      "retrieve_learning_examples_broad",
      { p_intent: intent, p_query: query.slice(0, 500), p_limit: limit }
    );
    if (!e2 && broad) examples = broad as LearningExample[];
  } else if (e1) {
    console.error("retrieveExamples primary error:", e1.message);
  }

  // Mark retrieved examples as used (fire and forget)
  if (examples.length > 0) {
    const ids = examples.map((e) => e.id).filter(Boolean);
    if (ids.length > 0) {
      void supabase.rpc("mark_examples_used", { p_ids: ids });
    }
  }

  return examples;
}

/**
 * Retrieve negative patterns ("things to avoid") for the current query.
 * Returns past queries that the user thumbs-downed plus the reasons.
 */
export async function retrieveNegativePatterns(
  intent: Intent,
  query: string,
  limit = 2
): Promise<NegativePattern[]> {
  const supabase = getSupabase();
  if (!supabase || !query || query.length < 3) return [];

  const { data, error } = await supabase.rpc("retrieve_negative_patterns", {
    p_intent: intent,
    p_query: query.slice(0, 500),
    p_limit: limit,
  });
  if (error) {
    console.error("retrieveNegativePatterns error:", error.message);
    return [];
  }
  return (data as NegativePattern[] | null) ?? [];
}

export function formatExamplesAsContext(examples: LearningExample[]): string {
  if (examples.length === 0) return "";
  const lines = [
    "Here are examples of past responses for similar queries that received positive feedback. Use them to inform style, structure, and depth — but do not copy verbatim.",
    "",
  ];
  examples.forEach((ex, i) => {
    const sim = ex.similarity ? ` (similarity ${(ex.similarity * 100).toFixed(0)}%)` : "";
    lines.push(`Example ${i + 1}${sim} — query: "${ex.query_summary}"`);
    lines.push("Response:");
    lines.push(ex.exemplar_response.slice(0, 800));
    lines.push("");
  });
  return lines.join("\n");
}

export function formatNegativePatternsAsContext(patterns: NegativePattern[]): string {
  if (patterns.length === 0) return "";
  const lines = [
    "AVOID THESE PATTERNS — past responses that received thumbs-down on similar queries. Do not produce responses in this style:",
    "",
  ];
  patterns.forEach((p, i) => {
    lines.push(`Avoid #${i + 1}: similar past query was "${p.query_text}"`);
    if (p.reason) lines.push(`  Why avoided: ${p.reason}`);
  });
  lines.push("");
  return lines.join("\n");
}
