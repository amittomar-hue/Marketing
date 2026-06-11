// ─────────────────────────────────────────────────────────────────
// Brand Voice Profile extractor.
//
// Reads the full brand library for one agent, asks a Groq model to
// produce a structured JSON profile (tone, audience, value props,
// preferred vocab, avoided terms, writing style), and persists it to
// brand_agents.voice_profile. The chat route reads this profile every
// turn and injects it as a permanent system-prompt addendum so that
// EVERY answer for the agent — not just turns that happen to retrieve
// brand chunks — sounds on-voice.
//
// Why not real fine-tuning: per-user GPU finetuning is $5-50/run with
// 30-90 min latency and ongoing maintenance every base model bump. A
// structured profile injected as system context closes ~95% of the
// quality gap at near-zero ongoing cost.
// ─────────────────────────────────────────────────────────────────

import OpenAI from "openai";

export interface VoiceProfile {
  tone_descriptors: string[];
  audience: string;
  value_props: string[];
  preferred_terms: string[];
  avoid_terms: string[];
  writing_style: string;
  /** Source-of-truth metadata so the UI can show "based on 24K chars across 3 docs". */
  extracted_from_chars: number;
  doc_count: number;
}

interface BrandDocLite {
  filename: string;
  text: string;
}

const EXTRACTOR_MODEL = "llama-3.3-70b-versatile";
const MAX_CHARS_PER_DOC = 6000;
const MAX_TOTAL_CHARS = 30_000;

const SYSTEM_PROMPT = `You are a senior brand voice strategist. You read a brand's authoritative documents (brand guidelines, style guides, messaging frameworks, ICP profiles, case studies, past campaigns) and produce a tight structured JSON profile of their voice and writing preferences.

Rules:
- Be SPECIFIC. Reject empty marketing words: "professional", "engaging", "innovative", "thought leader", "best-in-class", "cutting-edge", "world-class". If the docs give you a real adjective (e.g. "irreverent", "data-led", "skeptical of jargon"), use that.
- All fields required. If a field has no clear signal, infer the most plausible value from context — do NOT leave it blank or write "n/a".
- Lists return 3-7 items each, ordered by signal strength.
- writing_style is one paragraph (2-4 sentences) describing structural prose preferences: short sentences vs long, paragraph length, table/list usage, formality of pronouns, use of contractions, etc.
- Return ONLY valid JSON. No preamble, no explanation, no markdown fences.

Schema:
{
  "tone_descriptors": ["adjective", ...],         // 3-5 short adjectives
  "audience":         "one-line description",     // who the brand writes for
  "value_props":      ["short phrase", ...],      // 2-4 things the brand stands for
  "preferred_terms":  ["term", ...],              // 5-8 vocabulary preferences
  "avoid_terms":      ["term", ...],              // 3-5 generic-marketing terms they avoid
  "writing_style":    "one paragraph"
}`;

export async function extractVoiceProfile(
  docs: BrandDocLite[],
  apiKey: string
): Promise<VoiceProfile | null> {
  if (docs.length === 0) return null;

  // Slice each doc, then enforce a global cap so very large libraries
  // still fit comfortably within the model's input budget. Newest docs
  // first since uploads append (most relevant signal of current voice).
  const sliced: BrandDocLite[] = [];
  let totalChars = 0;
  for (const d of docs) {
    const remaining = MAX_TOTAL_CHARS - totalChars;
    if (remaining <= 0) break;
    const text = d.text.slice(0, Math.min(MAX_CHARS_PER_DOC, remaining));
    sliced.push({ filename: d.filename, text });
    totalChars += text.length;
  }

  const userMsg = sliced
    .map((d, i) => `[Doc ${i + 1}: ${d.filename}]\n${d.text}`)
    .join("\n\n---\n\n");

  const groq = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  try {
    const res = await groq.chat.completions.create({
      model: EXTRACTOR_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });
    const raw = res.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Omit<VoiceProfile, "extracted_from_chars" | "doc_count">;
    return {
      tone_descriptors: parsed.tone_descriptors ?? [],
      audience: parsed.audience ?? "",
      value_props: parsed.value_props ?? [],
      preferred_terms: parsed.preferred_terms ?? [],
      avoid_terms: parsed.avoid_terms ?? [],
      writing_style: parsed.writing_style ?? "",
      extracted_from_chars: totalChars,
      doc_count: sliced.length,
    };
  } catch (e) {
    console.error("extractVoiceProfile failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// End-to-end re-extraction helper. Loads the agent's brand docs from
// Supabase via the service-role client, runs the extractor, and
// persists the result to brand_agents.voice_profile. Used by both the
// auto-extract path on /api/brand/upload and the manual refresh endpoint.
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";

interface BrandDocText { filename: string; text: string }

export async function refreshVoiceProfile(
  service: SupabaseClient,
  agentId: string,
  groqKey: string
): Promise<VoiceProfile | null> {
  // Pull every chunk for this agent, reconstruct each doc's text from
  // its chunks ordered by chunk_index. brand_doc_chunks already has
  // the agent_id column after migration 0090 so the filter is cheap.
  const { data: chunks, error } = await service
    .from("brand_doc_chunks")
    .select("doc_id, chunk_index, text, brand_documents!inner(filename)")
    .eq("agent_id", agentId)
    .order("doc_id", { ascending: true })
    .order("chunk_index", { ascending: true });
  if (error || !chunks || chunks.length === 0) return null;

  // Reassemble: { filename, text } per doc_id, concatenating chunks in order.
  const byDoc = new Map<string, BrandDocText>();
  type ChunkRow = { doc_id: string; chunk_index: number; text: string;
                    brand_documents: { filename: string } | { filename: string }[] };
  for (const c of chunks as ChunkRow[]) {
    const filenameField = Array.isArray(c.brand_documents)
      ? c.brand_documents[0]?.filename
      : c.brand_documents?.filename;
    const filename = filenameField ?? "(unknown)";
    const existing = byDoc.get(c.doc_id);
    if (existing) existing.text += "\n\n" + c.text;
    else byDoc.set(c.doc_id, { filename, text: c.text });
  }
  const docs = Array.from(byDoc.values());

  const profile = await extractVoiceProfile(docs, groqKey);
  if (!profile) return null;

  await service
    .from("brand_agents")
    .update({
      voice_profile: profile,
      voice_profile_updated_at: new Date().toISOString(),
    })
    .eq("id", agentId);

  return profile;
}

/** Format the profile as a tight system-prompt fragment to be injected
 *  alongside the brand documents context every turn. Kept compact so it
 *  doesn't blow the token budget on long conversations. */
export function formatVoiceProfileForContext(profile: VoiceProfile | null): string {
  if (!profile) return "";
  const lines = [
    "USER'S BRAND VOICE PROFILE — Apply these on every answer. Tone, audience, vocabulary, and structural preferences below are the operating voice for ALL output, not optional flavor.",
    "",
    `Tone: ${profile.tone_descriptors.join(", ")}`,
    `Audience: ${profile.audience}`,
    `What the brand stands for: ${profile.value_props.join("; ")}`,
    `Preferred vocabulary: ${profile.preferred_terms.join(", ")}`,
    `Avoid these terms: ${profile.avoid_terms.join(", ")}`,
    `Writing style: ${profile.writing_style}`,
    "",
  ];
  return lines.join("\n");
}
