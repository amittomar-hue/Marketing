import { getSupabase } from "./supabase";

export interface TrainingPair {
  id: string;
  intent: string;
  asset_type: string;
  instruction: string;
  output: string;
  source_url: string | null;
  source_title: string | null;
  similarity: number;
  composite_score: number;
}

/**
 * Retrieve the top-N highest-relevance training pairs from the continuously-
 * scraped marketing knowledge base. This is the Tuned model's PRIMARY signal —
 * the asset-type-aware, quality-filtered, source-cited Q&A pairs produced by
 * the scrape-intel → convert-pairs pipeline.
 *
 * Each pair carries the original source URL so the model can cite where the
 * knowledge came from.
 */
export async function retrieveTrainingPairs(
  query: string,
  intent: string,
  limit = 5
): Promise<TrainingPair[]> {
  const supa = getSupabase();
  if (!supa || !query || query.length < 3) return [];

  const { data, error } = await supa.rpc("retrieve_training_pairs_for_chat", {
    p_query: query.slice(0, 500),
    p_intent: intent,
    p_limit: limit,
  });
  if (error) {
    // Most likely cause: RPC not deployed yet. Fail soft so the chat still works.
    console.error("retrieveTrainingPairs error:", error.message);
    return [];
  }
  return (data as TrainingPair[] | null) ?? [];
}

/**
 * Format training pairs as the Tuned model's primary system context.
 * Heavily annotated so the model knows these are CURATED EXEMPLARS from
 * a continuously-updated marketing knowledge base, not just retrieval hits.
 */
export function formatTrainingPairsAsContext(pairs: TrainingPair[]): string {
  if (pairs.length === 0) return "";

  const lines = [
    "═══════════════════════════════════════════════════════════════",
    "DMOOP TUNED — YOUR CONTINUOUSLY-LEARNED MARKETING KNOWLEDGE BASE",
    "═══════════════════════════════════════════════════════════════",
    "",
    "Below are the most relevant Q&A pairs from your training corpus —",
    "curated from the live marketing web (130+ scraped queries across 13",
    "asset types every 6 hours, then asset-type-aware-converted into",
    "training pairs). These are your PRIMARY signal.",
    "",
    "How to use them:",
    "1. Match the STRUCTURE, DEPTH, and VOICE of the closest pair(s).",
    "2. PULL specific tactics, numbers, frameworks, and named tools from them.",
    "3. CITE the source URL when you use a tactic/stat from a pair.",
    "4. If multiple pairs cover the same angle, SYNTHESIZE — don't repeat.",
    "5. Do NOT copy verbatim. Adapt to the user's exact question.",
    "",
  ];

  pairs.forEach((p, i) => {
    const sim = (p.similarity * 100).toFixed(0);
    const score = (p.composite_score * 100).toFixed(0);
    lines.push(`────── Training pair #${i + 1} ──────`);
    lines.push(
      `intent: ${p.intent}  ·  asset_type: ${p.asset_type}  ·  similarity: ${sim}%  ·  composite: ${score}`
    );
    if (p.source_title) lines.push(`source: "${p.source_title}"`);
    if (p.source_url) lines.push(`source_url: ${p.source_url}`);
    lines.push("");
    lines.push(`Q: ${p.instruction}`);
    lines.push("");
    lines.push("A:");
    // Cap each answer at 700 chars so 5 pairs ≈ 3.5K chars total (fits Groq TPM)
    lines.push(p.output.slice(0, 700));
    lines.push("");
  });

  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("End of knowledge base. Now answer the user's question.");
  lines.push("═══════════════════════════════════════════════════════════════");

  return lines.join("\n");
}
