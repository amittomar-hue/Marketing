import { getSupabase, Intent } from "./supabase";

interface LearningExample {
  query_summary: string;
  exemplar_response: string;
  score: number;
}

export async function logInteraction(args: {
  user_query: string;
  intent: Intent;
  response: string;
  model: string;
  web_search_used: boolean;
  session_id?: string;
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

export async function retrieveExamples(
  intent: Intent,
  query: string,
  limit = 3
): Promise<LearningExample[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("learning_examples")
    .select("query_summary, exemplar_response, score")
    .eq("intent", intent)
    .gte("score", 1.0)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("retrieveExamples error:", error.message);
    return [];
  }
  return (data ?? []) as LearningExample[];
}

export function formatExamplesAsContext(examples: LearningExample[]): string {
  if (examples.length === 0) return "";
  const lines = [
    "Here are examples of past responses for similar queries that received positive feedback. Use them to inform style, structure, and depth — but do not copy verbatim.",
    "",
  ];
  examples.forEach((ex, i) => {
    lines.push(`Example ${i + 1} — query: "${ex.query_summary}"`);
    lines.push("Response:");
    lines.push(ex.exemplar_response.slice(0, 1500));
    lines.push("");
  });
  return lines.join("\n");
}
