import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { interaction_id, rating, user_edit, notes } = await req.json();

  if (!interaction_id || typeof rating !== "number") {
    return NextResponse.json(
      { error: "interaction_id and rating are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("feedbacks")
    .insert({ interaction_id, rating, user_edit, notes })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch the linked interaction so we can act on the feedback
  const { data: interaction } = await supabase
    .from("interactions")
    .select("id, user_query, intent, response")
    .eq("id", interaction_id)
    .single();

  if (interaction) {
    if (rating > 0) {
      // Thumbs-up → promote to learning_examples
      const summary = interaction.user_query.slice(0, 200);
      await supabase.from("learning_examples").upsert(
        {
          interaction_id: interaction.id,
          intent: interaction.intent ?? "general",
          query_summary: summary,
          exemplar_response: interaction.response,
          score: 1.0,
        },
        { onConflict: "interaction_id" }
      );
    } else if (rating < 0) {
      // Thumbs-down → log as a negative pattern to avoid
      await supabase.from("negative_patterns").insert({
        intent: interaction.intent ?? "general",
        query_text: interaction.user_query.slice(0, 500),
        bad_response: interaction.response.slice(0, 2000),
        reason: notes ?? "User flagged response as poor",
        feedback_id: data.id,
      });

      // Also lower the score of any existing learning_example tied to this interaction
      await supabase
        .from("learning_examples")
        .update({ score: 0.3 })
        .eq("interaction_id", interaction.id);
    }
  }

  return NextResponse.json({ id: data.id, ok: true });
}
