// ─────────────────────────────────────────────────────────────────
// /api/brand/documents/[id]  — single-doc operations beyond the
// list/delete on the sibling root route. Currently exposes PATCH for
// reassigning a document (and its chunks) to a different Brand Agent.
// Used by the bulk-move action on /brand and any future "move to…"
// affordances on the per-doc admin views.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

async function getUserClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: () => {},
      },
    }
  );
}

interface PatchBody {
  agent_id?: string;
}

// PATCH /api/brand/documents/[id]
// Body: { agent_id }  — re-home the document AND its chunks under the
// target agent. Both writes happen via the service-role client so the
// agent_id NOT NULL constraint can't trip; ownership is enforced
// explicitly via .eq("user_id", user.id) on both updates.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supa = await getUserClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  const { id } = await params;
  const body: PatchBody = await req.json().catch(() => ({}));
  const targetAgentId = body.agent_id;
  if (!targetAgentId) {
    return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  }

  // Validate the user actually owns the target agent — RLS already
  // prevents cross-user reads on brand_agents, but we surface a
  // cleaner 400 here rather than letting the FK update silently no-op
  // when the agent doesn't exist for this user.
  const { data: agent } = await service
    .from("brand_agents")
    .select("id")
    .eq("id", targetAgentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!agent) {
    return NextResponse.json({ error: "Invalid target agent" }, { status: 400 });
  }

  // Update the document row first; chunks follow. user_id constraint
  // on both queries means a malicious id in the URL can't write into
  // someone else's library.
  const { error: docErr } = await service
    .from("brand_documents")
    .update({ agent_id: targetAgentId })
    .eq("id", id)
    .eq("user_id", user.id);
  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });

  const { error: chunkErr } = await service
    .from("brand_doc_chunks")
    .update({ agent_id: targetAgentId })
    .eq("doc_id", id)
    .eq("user_id", user.id);
  if (chunkErr) return NextResponse.json({ error: chunkErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
