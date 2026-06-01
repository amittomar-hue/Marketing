import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";
import { chunkText } from "@/lib/brand";
import { logSafetyIncident } from "@/lib/safety";

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

  const { filename, text, doc_type, pii_summary } = body as {
    filename: string;
    text: string;
    doc_type?: string;
    pii_summary?: { total: number; by_type: Record<string, number> } | null;
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

  // Log the PII redaction event for the admin Safety tab. The client did the
  // actual redaction in-browser; we just log the summary so admins know which
  // brand docs had PII scrubbed and how much.
  if (pii_summary && pii_summary.total > 0) {
    await logSafetyIncident({
      kind: "pii_redacted",
      severity: pii_summary.total >= 10 ? "high" : "medium",
      categories: Object.keys(pii_summary.by_type),
      excerpt: `${filename.slice(0, 200)} — ${pii_summary.total} items: ${
        Object.entries(pii_summary.by_type).map(([k, v]) => `${v}× ${k}`).join(", ")
      }`,
      action_taken: "redacted",
      user_id: user.id,
      user_email: user.email ?? null,
      metadata: { filename, doc_type: doc_type ?? "general", by_type: pii_summary.by_type },
    });
  }

  return NextResponse.json({ ok: true, doc });
}
