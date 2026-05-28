import { NextRequest, NextResponse } from "next/server";
import { getSupabase, INTENTS } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Weekly aggregation cron — runs every Monday 02:00 UTC via vercel.json.
 *
 * For each intent, looks at the last 7 days of interactions + feedback:
 *  - Promotes the top-rated 3 interactions per intent to learning_examples (boost score)
 *  - Decays older example scores
 *  - Writes a learning_insight row describing what was learned
 */
export async function GET(req: NextRequest) {
  // Auth: Vercel Cron sends a bearer token in `Authorization` header
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const results: Record<string, { promoted: number; decayed: number }> = {};

  for (const intent of INTENTS) {
    // Top-rated interactions in this window
    const { data: topRated, error: topErr } = await supabase
      .rpc("get_top_rated_interactions", {
        p_intent: intent,
        p_since: weekAgo.toISOString(),
        p_limit: 3,
      })
      .select();

    let promoted = 0;
    if (!topErr && topRated) {
      for (const r of topRated as Array<{
        id: string;
        user_query: string;
        response: string;
        avg_rating: number;
      }>) {
        await supabase.from("learning_examples").upsert(
          {
            interaction_id: r.id,
            intent,
            query_summary: r.user_query.slice(0, 200),
            exemplar_response: r.response,
            score: 1.0 + Math.max(0, r.avg_rating),
          },
          { onConflict: "interaction_id" }
        );
        promoted++;
      }
    }

    // Decay older examples — anything not used in the last 14 days loses 20% score
    const fortnightAgo = new Date(now.getTime() - 14 * 86400000).toISOString();
    const { data: decayedRows } = await supabase
      .from("learning_examples")
      .update({ score: 0.8 })
      .eq("intent", intent)
      .lt("last_used_at", fortnightAgo)
      .gt("score", 0.5)
      .select("id");
    const decayed = decayedRows?.length ?? 0;

    await supabase.from("learning_insights").insert({
      period_start: weekAgo.toISOString(),
      period_end: now.toISOString(),
      intent,
      pattern: `Promoted ${promoted} new exemplars, decayed ${decayed} stale ones`,
      sample_size: promoted + decayed,
      confidence: 0.8,
    });

    results[intent] = { promoted, decayed };
  }

  return NextResponse.json({ ok: true, week_ending: now.toISOString(), results });
}
