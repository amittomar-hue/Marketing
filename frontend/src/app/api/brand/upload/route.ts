import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";
import { chunkText } from "@/lib/brand";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_DOCS_PER_USER = 50;
const MAX_TEXT_CHARS = 200_000;

export async function POST(req: NextRequest) {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { filename, text, doc_type } = body as {
    filename: string;
    text: string;
    doc_type?: string;
  };

  if (!filename || !text) {
    return NextResponse.json(
      { error: "filename and text are required" },
      { status: 400 }
    );
  }

  // Enforce quota
  const { count } = await service
    .from("brand_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_DOCS_PER_USER) {
    return NextResponse.json(
      { error: `Document limit reached (${MAX_DOCS_PER_USER}). Delete one to add another.` },
      { status: 400 }
    );
  }

  const cleanText = text.slice(0, MAX_TEXT_CHARS);
  const chunks = chunkText(cleanText, 1000, 150);

  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "Document has too little extractable text" },
      { status: 400 }
    );
  }

  const { data: doc, error: docErr } = await service
    .from("brand_documents")
    .insert({
      user_id: user.id,
      filename: filename.slice(0, 240),
      doc_type: doc_type ?? "general",
      total_chars: cleanText.length,
      total_chunks: chunks.length,
    })
    .select("id, filename, doc_type, total_chars, total_chunks, uploaded_at")
    .single();

  if (docErr || !doc) {
    return NextResponse.json({ error: docErr?.message ?? "Insert failed" }, { status: 500 });
  }

  const rows = chunks.map((text, i) => ({
    doc_id: doc.id,
    user_id: user.id,
    chunk_index: i,
    text,
    char_count: text.length,
  }));

  const { error: chunkErr } = await service.from("brand_doc_chunks").insert(rows);
  if (chunkErr) {
    // Roll back the doc
    await service.from("brand_documents").delete().eq("id", doc.id);
    return NextResponse.json({ error: chunkErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, doc });
}
