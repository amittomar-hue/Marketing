import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
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

  // If thumbs up — auto-promote this interaction to a learning example
  if (rating > 0) {
    const { data: interaction } = await supabase
      .from("interactions")
      .select("id, user_query, intent, response")
      .eq("id", interaction_id)
      .single();

    if (interaction) {
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
    }
  }

  return NextResponse.json({ id: data.id, ok: true });
}
