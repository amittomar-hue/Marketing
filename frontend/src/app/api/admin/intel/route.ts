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
  const assetType = url.searchParams.get("asset_type");

  let q = service
    .from("marketing_intel")
    .select("id, topic, category, asset_type, title, url, summary, source, scraped_at, published_at, converted_to_training", { count: "exact" })
    .order("scraped_at", { ascending: false })
    .limit(limit);

  if (category) q = q.eq("category", category);
  if (assetType) q = q.eq("asset_type", assetType);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get latest run info
  const { data: runs } = await service
    .from("intel_scrape_runs")
    .select("started_at, finished_at, items_added, items_skipped")
    .order("started_at", { ascending: false })
    .limit(1);

  // Asset-type breakdown across all intel (not just the filtered slice)
  const { data: breakdownRows } = await service
    .from("marketing_intel")
    .select("asset_type, converted_to_training");

  const breakdown: Record<string, { total: number; converted: number; pending: number }> = {};
  for (const r of breakdownRows ?? []) {
    const key = (r.asset_type as string) ?? "article";
    if (!breakdown[key]) breakdown[key] = { total: 0, converted: 0, pending: 0 };
    breakdown[key].total++;
    if (r.converted_to_training) breakdown[key].converted++;
    else breakdown[key].pending++;
  }

  // Recent conversion run
  const { data: convRuns } = await service
    .from("conversion_runs")
    .select("started_at, finished_at, intel_processed, pairs_created, pairs_skipped")
    .order("started_at", { ascending: false })
    .limit(1);

  // Totals
  const { count: totalIntel } = await service
    .from("marketing_intel")
    .select("*", { count: "exact", head: true });
  const { count: pendingIntel } = await service
    .from("marketing_intel")
    .select("*", { count: "exact", head: true })
    .eq("converted_to_training", false);
  const { count: totalPairs } = await service
    .from("training_pairs")
    .select("*", { count: "exact", head: true });
  const { count: originalPairs } = await service
    .from("training_pairs")
    .select("*", { count: "exact", head: true })
    .eq("is_evolved", false);
  const { count: evolvedPairs } = await service
    .from("training_pairs")
    .select("*", { count: "exact", head: true })
    .eq("is_evolved", true);

  return NextResponse.json({
    items: data,
    total: count ?? 0,
    last_run: runs?.[0] ?? null,
    last_conversion: convRuns?.[0] ?? null,
    breakdown,
    totals: {
      intel_total: totalIntel ?? 0,
      intel_pending_conversion: pendingIntel ?? 0,
      training_pairs_total: totalPairs ?? 0,
      training_pairs_original: originalPairs ?? 0,
      training_pairs_evolved: evolvedPairs ?? 0,
    },
  });
}
