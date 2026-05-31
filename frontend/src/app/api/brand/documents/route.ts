import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  const { data, error } = await service
    .from("brand_documents")
    .select("id, filename, doc_type, total_chars, total_chunks, uploaded_at")
    .eq("user_id", user.id)
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalChars = (data ?? []).reduce((s, d) => s + d.total_chars, 0);
  const totalChunks = (data ?? []).reduce((s, d) => s + d.total_chunks, 0);

  return NextResponse.json({
    documents: data ?? [],
    total_documents: data?.length ?? 0,
    total_chars: totalChars,
    total_chunks: totalChunks,
  });
}

export async function DELETE(req: NextRequest) {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  const { error } = await service
    .from("brand_documents")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // double-check ownership

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
