// ─────────────────────────────────────────────────────────────────
// POST /api/brand/agents/[id]/refresh-profile
// Manually triggers a Brand Voice Profile re-extraction for one
// agent. Surfaced as a "Re-extract" button on the /agents page so
// users can refresh after editing brand docs in place (without
// uploading a new file) or after the extractor produced a profile
// they want to retry. Auto-refresh on upload covers the common case;
// this endpoint covers the rest.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";
import { refreshVoiceProfile } from "@/lib/voice-profile";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return NextResponse.json({ error: "GROQ_API_KEY missing" }, { status: 503 });

  const { id } = await params;

  // Confirm ownership before doing the (mildly expensive) extraction
  // — extractor is fast but a Groq call is still a Groq call.
  const { data: agent } = await service
    .from("brand_agents")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profile = await refreshVoiceProfile(service, id, groqKey);
  if (!profile) {
    return NextResponse.json(
      { error: "No documents to extract from, or extractor failed. Upload a brand doc first." },
      { status: 400 }
    );
  }

  return NextResponse.json({ profile });
}
