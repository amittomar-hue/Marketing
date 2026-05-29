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
  if (!service) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  // Aggregate stats
  const [{ count: totalInteractions }, { count: totalFeedbacks }, { count: totalUsers }, { data: byIntent }, { data: byUser }] =
    await Promise.all([
      service.from("interactions").select("id", { count: "exact", head: true }),
      service.from("feedbacks").select("id", { count: "exact", head: true }),
      service.from("profiles").select("id", { count: "exact", head: true }),
      service.rpc("admin_top_intents", { p_limit: 10 }).select("*"),
      service.rpc("admin_top_users", { p_limit: 10 }).select("*"),
    ]);

  return NextResponse.json({
    totals: {
      interactions: totalInteractions ?? 0,
      feedbacks: totalFeedbacks ?? 0,
      users: totalUsers ?? 0,
    },
    by_intent: byIntent ?? [],
    by_user: byUser ?? [],
  });
}
