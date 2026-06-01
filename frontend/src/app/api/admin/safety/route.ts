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
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);
  const kind = url.searchParams.get("kind");

  let q = service
    .from("safety_incidents")
    .select("id, occurred_at, user_email, kind, severity, categories, excerpt, action_taken, model, metadata")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (kind) q = q.eq("kind", kind);

  const { data: incidents, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: health } = await service
    .from("v_safety_health")
    .select("*")
    .single();

  return NextResponse.json({ health, incidents: incidents ?? [] });
}
