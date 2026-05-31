import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, isAdminEmail } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  const url = req.nextUrl;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const category = url.searchParams.get("category");

  let q = service
    .from("marketing_intel")
    .select("id, topic, category, title, url, summary, source, scraped_at, published_at", { count: "exact" })
    .order("scraped_at", { ascending: false })
    .limit(limit);

  if (category) q = q.eq("category", category);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get latest run info
  const { data: runs } = await service
    .from("intel_scrape_runs")
    .select("started_at, finished_at, items_added, items_skipped")
    .order("started_at", { ascending: false })
    .limit(1);

  return NextResponse.json({
    items: data,
    total: count ?? 0,
    last_run: runs?.[0] ?? null,
  });
}
