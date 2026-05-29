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
  if (!service) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const url = req.nextUrl;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const intentFilter = url.searchParams.get("intent");
  const emailFilter = url.searchParams.get("email");

  let q = service
    .from("interactions")
    .select("id, user_query, intent, response, model, user_email, web_search_used, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (intentFilter) q = q.eq("intent", intentFilter);
  if (emailFilter) q = q.ilike("user_email", `%${emailFilter}%`);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data, total: count ?? 0, limit, offset });
}
