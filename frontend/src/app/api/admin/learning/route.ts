import { NextResponse } from "next/server";
import { createSupabaseServerClient, isAdminEmail } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  const [{ data: health }, { data: examples }, { data: negatives }] = await Promise.all([
    service.from("v_learning_health").select("*").single(),
    service
      .from("learning_examples")
      .select("id, intent, query_summary, exemplar_response, score, usage_count, last_used_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    service
      .from("negative_patterns")
      .select("id, intent, query_text, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    health: health ?? null,
    examples: examples ?? [],
    negatives: negatives ?? [],
  });
}
