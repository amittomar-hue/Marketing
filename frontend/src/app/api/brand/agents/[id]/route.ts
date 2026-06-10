// ─────────────────────────────────────────────────────────────────
// /api/brand/agents/[id]  — PATCH (rename / recolor / set-default)
// and DELETE for a specific agent. RLS in Postgres enforces ownership
// so the [id] in the URL can't reach another user's agent.
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
        setAll: () => {},
      },
    }
  );
}

interface PatchBody {
  name?: string;
  color?: string;
  is_default?: boolean;
}

// PATCH /api/brand/agents/[id]
// Body: { name?, color?, is_default? }
// Setting is_default=true unsets the previous default in a small
// transaction so the partial unique index doesn't conflict.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supa = await getClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body: PatchBody = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim().slice(0, 80);
  }
  if (typeof body.color === "string" && body.color.trim()) {
    update.color = body.color.trim().slice(0, 9);
  }

  if (body.is_default === true) {
    // Unset any other current default before flipping this one — the
    // partial unique index `brand_agents_one_default_per_user` would
    // otherwise reject the update mid-flight.
    await supa
      .from("brand_agents")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true)
      .neq("id", id);
    update.is_default = true;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { data: agent, error } = await supa
    .from("brand_agents")
    .update(update)
    .eq("id", id)
    .select("id, name, color, is_default, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ agent });
}

// DELETE /api/brand/agents/[id]
// Refuses to delete the user's last remaining agent — they'd lose
// the ability to upload brand docs entirely. Also refuses to delete
// the default if siblings exist (the user should re-set default first).
// Cascades via FK: docs + chunks + chat_conversations.agent_id all
// follow the FK rules from the migration (CASCADE for docs/chunks,
// SET NULL for conversations).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supa = await getClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: all } = await supa
    .from("brand_agents")
    .select("id, is_default");
  if (!all || all.length === 0) {
    return NextResponse.json({ error: "no agents" }, { status: 404 });
  }
  if (all.length === 1) {
    return NextResponse.json(
      { error: "cannot delete your last remaining agent" },
      { status: 400 }
    );
  }
  const target = all.find((a) => a.id === id);
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (target.is_default) {
    return NextResponse.json(
      { error: "set another agent as default before deleting this one" },
      { status: 400 }
    );
  }

  const { error } = await supa.from("brand_agents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
