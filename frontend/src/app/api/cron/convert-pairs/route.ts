import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 300;

type AssetType =
  | "article" | "whitepaper" | "ebook" | "playbook" | "case_study"
  | "social_post" | "ad_campaign" | "report" | "newsletter" | "podcast"
  | "video" | "template" | "guide";

interface QAPair {
  instruction: string;
  output: string;
}

// ─────────────────────────────────────────────────────────────────
// Asset-type-aware prompts. Each prompt tunes the angle, voice, and
// shape of the Q&A pairs so DMOOP learns the *right kind of marketing
// answer* for each artifact (a social-post breakdown sounds nothing
// like an ABM whitepaper analysis).
// ─────────────────────────────────────────────────────────────────
const PROMPTS: Record<AssetType, string> = {
  article: `You are generating training data for DMOOP — a marketing LLM. From the article excerpt, produce 3 instruction-tuning Q&A pairs.
- "instruction": realistic marketing-team question (~10-25 words).
- "output": direct markdown answer grounded ONLY in the article. ~150-400 words.
- Cover 3 different angles: tactical, strategic, analytical.
Return ONLY a valid JSON array. No prose.`,

  whitepaper: `You are generating training data for DMOOP from a marketing whitepaper. Produce 3 Q&A pairs that emphasize evidence, benchmarks, and research-backed claims.
- "instruction": question a marketing strategist would ask when validating an approach (~10-25 words).
- "output": cite the whitepaper's specific data points, benchmarks, or research framework. Use markdown with bullets. ~200-400 words.
- One pair MUST surface a benchmark or stat. One pair MUST surface a research framework.
Return ONLY a valid JSON array. No prose.`,

  ebook: `You are generating training data for DMOOP from an ebook excerpt. Produce 3 Q&A pairs that teach the ebook's full mental model.
- "instruction": question a marketer would ask while reading the ebook (~10-25 words).
- "output": markdown answer with structured sections (## Step / ## Framework / ## Example). ~250-450 words.
- Pairs should cover: (1) the core framework, (2) a tactical application, (3) a common pitfall the ebook warns against.
Return ONLY a valid JSON array. No prose.`,

  playbook: `You are generating training data for DMOOP from a marketing playbook. Produce 3 Q&A pairs that are TACTICAL and OPERATIONAL.
- "instruction": "How do I…" or "What's the step-by-step…" style question (~10-25 words).
- "output": numbered steps with concrete actions, tools, timeframes. Use markdown. ~200-400 words.
- Every pair MUST contain a numbered or bulleted step sequence the user can execute today.
Return ONLY a valid JSON array. No prose.`,

  case_study: `You are generating training data for DMOOP from a marketing case study. Produce 3 Q&A pairs that teach pattern-matching from real outcomes.
- "instruction": question framing the situation OR asking what worked (~10-25 words).
- "output": markdown answer with **Situation / Approach / Result** sections. Include specific metrics (%, $, lift) wherever the source mentions them. ~200-400 words.
- One pair MUST surface the headline result/metric. One pair MUST extract the transferable lesson.
Return ONLY a valid JSON array. No prose.`,

  social_post: `You are generating training data for DMOOP from a high-performing marketing social post. Produce 3 Q&A pairs that teach the *craft* of the post.
- "instruction": question about hook, structure, voice, or virality drivers (~10-25 words).
- "output": short, punchy markdown answer. Break down the post's hook, narrative shape, CTA. Include the verbatim hook or key line in a > blockquote. ~120-300 words.
- One pair MUST be a "rewrite this for [different audience]" style example.
Return ONLY a valid JSON array. No prose.`,

  ad_campaign: `You are generating training data for DMOOP from an ad campaign breakdown. Produce 3 Q&A pairs that teach campaign craft.
- "instruction": question about creative concept, targeting, message, or results (~10-25 words).
- "output": markdown sections covering **Insight / Creative / Channel / Result**. ~200-400 words.
- One pair MUST extract the core consumer/buyer insight. One pair MUST surface the channel + format choice and why.
Return ONLY a valid JSON array. No prose.`,

  report: `You are generating training data for DMOOP from an industry report. Produce 3 Q&A pairs that surface benchmarks and strategic implications.
- "instruction": question a CMO or marketing director would ask of the report (~10-25 words).
- "output": markdown answer leading with the headline number, then **What it means** and **What to do**. ~200-400 words.
- Every pair MUST cite a number or benchmark from the report.
Return ONLY a valid JSON array. No prose.`,

  newsletter: `You are generating training data for DMOOP from a marketing newsletter issue. Produce 3 Q&A pairs that capture the news + the so-what.
- "instruction": "What happened with…" or "Why does X matter for marketers" (~10-25 words).
- "output": tight markdown answer: 1-sentence summary, then bullet implications. ~120-250 words.
- Bias toward recency: treat the newsletter as the source of truth on *this week's* development.
Return ONLY a valid JSON array. No prose.`,

  podcast: `You are generating training data for DMOOP from podcast show notes/transcript. Produce 3 Q&A pairs that surface guest expertise.
- "instruction": question the host would ask, or a listener would search for (~10-25 words).
- "output": markdown answer in the *guest's voice/POV* where the transcript supports it, with their key takeaway and supporting reasoning. ~200-400 words.
Return ONLY a valid JSON array. No prose.`,

  video: `You are generating training data for DMOOP from a webinar or video transcript. Produce 3 Q&A pairs grounded in what was said.
- "instruction": realistic marketing question (~10-25 words).
- "output": markdown answer summarizing the speaker's argument with at least one near-verbatim quote in a > blockquote. ~200-400 words.
Return ONLY a valid JSON array. No prose.`,

  template: `You are generating training data for DMOOP from a marketing template/framework. Produce 3 Q&A pairs that teach how to USE the template.
- "instruction": "How do I fill out…" or "What goes in section X" style (~10-25 words).
- "output": markdown answer with the template fields/sections, what each one captures, and an example. ~200-400 words.
- One pair MUST show a fully filled-in example.
Return ONLY a valid JSON array. No prose.`,

  guide: `You are generating training data for DMOOP from a long-form how-to guide. Produce 3 Q&A pairs that teach end-to-end execution.
- "instruction": "How do I…" or "What's the complete approach to…" (~10-25 words).
- "output": markdown answer with ## sections covering the guide's progression. ~250-450 words.
- Pairs should ladder up from beginner → intermediate → advanced where the source supports it.
Return ONLY a valid JSON array. No prose.`,
};

function pickPrompt(asset_type: string | null | undefined): string {
  const k = (asset_type ?? "article") as AssetType;
  return PROMPTS[k] ?? PROMPTS.article;
}

async function generatePairs(
  groq: OpenAI,
  asset_type: string | null | undefined,
  category: string,
  title: string,
  summary: string
): Promise<QAPair[]> {
  const systemPrompt = pickPrompt(asset_type);
  const userPrompt = `Asset type: ${asset_type ?? "article"}
Marketing category: ${category}
Source title: ${title}

Source excerpt:
${summary}

Generate 3 training Q&A pairs in the required JSON format.`;

  // 8B-instant: 5× the free-tier TPD quota of 70B (500K vs 100K).
  // The bottleneck is daily throughput, not single-call quality.
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.65,
    max_tokens: 2000,
  });

  const text = response.choices[0]?.message?.content ?? "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const pairs = JSON.parse(match[0]) as QAPair[];
    return pairs.filter(
      (p) => typeof p.instruction === "string" && typeof p.output === "string" &&
             p.instruction.length > 10 && p.output.length > 50
    );
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron && process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return NextResponse.json({ error: "GROQ_API_KEY missing" }, { status: 503 });

  const supa = getSupabase();
  if (!supa) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  const groq = new OpenAI({
    apiKey: groqKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const url = req.nextUrl;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);
  const assetFilter = url.searchParams.get("asset_type");

  const { data: runRow } = await supa
    .from("conversion_runs")
    .insert({})
    .select("id")
    .single();
  const runId = runRow?.id;

  let query = supa
    .from("marketing_intel")
    .select("id, category, asset_type, title, url, summary")
    .eq("converted_to_training", false)
    .not("summary", "is", null)
    .gte("scraped_at", new Date(Date.now() - 60 * 86400000).toISOString())
    .order("scraped_at", { ascending: false })
    .limit(limit);
  if (assetFilter) query = query.eq("asset_type", assetFilter);

  const { data: intelRows } = await query;

  const rows = intelRows ?? [];
  let pairsCreated = 0;
  let pairsSkipped = 0;
  const byAsset: Record<string, number> = {};

  for (const row of rows) {
    try {
      const summary = (row.summary ?? "").slice(0, 1500);
      if (summary.length < 200) {
        pairsSkipped++;
        continue;
      }
      const pairs = await generatePairs(groq, row.asset_type, row.category, row.title, summary);
      for (const p of pairs) {
        const { error } = await supa.from("training_pairs").insert({
          intel_id: row.id,
          intent: row.category,
          asset_type: row.asset_type ?? "article",
          instruction: p.instruction,
          output: p.output,
          source_url: row.url,
          source_title: row.title,
          quality: 1.0,
        });
        if (!error) {
          pairsCreated++;
          const key = row.asset_type ?? "article";
          byAsset[key] = (byAsset[key] ?? 0) + 1;
        }
      }
      await supa
        .from("marketing_intel")
        .update({ converted_to_training: true })
        .eq("id", row.id);
    } catch (err) {
      console.error("convert pair error:", err);
      pairsSkipped++;
    }
  }

  if (runId) {
    await supa
      .from("conversion_runs")
      .update({
        finished_at: new Date().toISOString(),
        intel_processed: rows.length,
        pairs_created: pairsCreated,
        pairs_skipped: pairsSkipped,
      })
      .eq("id", runId);
  }

  return NextResponse.json({
    ok: true,
    run_id: runId,
    intel_processed: rows.length,
    pairs_created: pairsCreated,
    pairs_skipped: pairsSkipped,
    by_asset: byAsset,
  });
}
