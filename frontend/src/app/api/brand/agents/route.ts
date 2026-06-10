// ─────────────────────────────────────────────────────────────────
// /api/brand/agents  — list + create Brand Agents for the signed-in
// user. PATCH / DELETE / set-default live at the [id] sibling route.
//
// Auth model: every operation reads the user from the request's
// Supabase server-client session and enforces user_id scoping via
// RLS (the brand_agents table's policies require auth.uid() = user_id).
// We never trust an agent_id from the client without that RLS check.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

async function getClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: () => {
          /* read-only in route handlers */
        },
      },
    }
  );
}

// GET /api/brand/agents — list this user's agents, newest-first,
// with a doc_count rollup so the UI can show "Acme · 7 docs" etc.
export async function GET() {
  const supa = await getClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: agents, error } = await supa
    .from("brand_agents")
    .select("id, name, color, is_default, created_at, updated_at")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Doc-count rollup — one extra round-trip rather than a complex
  // join. Cheap because the user typically has <10 agents.
  const { data: docCounts } = await supa
    .from("brand_documents")
    .select("agent_id")
    .eq("user_id", user.id);
  const countByAgent = new Map<string, number>();
  for (const row of docCounts ?? []) {
    const id = (row as { agent_id: string }).agent_id;
    countByAgent.set(id, (countByAgent.get(id) ?? 0) + 1);
  }

  return NextResponse.json({
    agents: (agents ?? []).map((a) => ({
      ...a,
      doc_count: countByAgent.get(a.id) ?? 0,
    })),
  });
}

// POST /api/brand/agents — create a new agent. Body: { name, color? }.
// If the user has zero agents (brand-new account), the created one is
// auto-marked as default; otherwise it's a non-default sibling.
export async function POST(req: NextRequest) {
  const supa = await getClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = (body?.name ?? "").toString().trim().slice(0, 80);
  const color = (body?.color ?? "#c14a2a").toString().trim().slice(0, 9);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { count: existingCount } = await supa
    .from("brand_agents")
    .select("id", { count: "exact", head: true });
  const isFirst = (existingCount ?? 0) === 0;

  const { data: agent, error } = await supa
    .from("brand_agents")
    .insert({
      user_id: user.id,
      name,
      color,
      is_default: isFirst,
    })
    .select("id, name, color, is_default, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ agent: { ...agent, doc_count: 0 } });
}
