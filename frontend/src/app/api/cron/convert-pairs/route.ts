import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 300;

const SYSTEM_PROMPT = `You are generating training data for a Marketing LLM. From the provided marketing article excerpt, produce 3 high-quality instruction-tuning Q&A pairs.

Requirements for each pair:
- "instruction": A realistic question a marketing professional might ask DMOOP. Specific, scoped, ~10-25 words.
- "output": A direct, structured answer drawing ONLY from the article content. Use clean markdown. Include the article's key facts, frameworks, or tactics. ~150-400 words.
- The 3 pairs should cover DIFFERENT angles of the article (e.g., one tactical, one strategic, one analytical).

Return ONLY a valid JSON array. No prose, no markdown wrapper.

Format:
[
  {"instruction": "...", "output": "..."},
  {"instruction": "...", "output": "..."},
  {"instruction": "...", "output": "..."}
]`;

interface QAPair {
  instruction: string;
  output: string;
}

async function generatePairs(
  groq: OpenAI,
  category: string,
  title: string,
  summary: string
): Promise<QAPair[]> {
  const userPrompt = `Article category: ${category}
Article title: ${title}

Article excerpt:
${summary}

Generate 3 training Q&A pairs.`;

  // Use 8B-instant for conversion — 5x larger free-tier quota than 70B
  // (500K TPD vs 100K TPD) which is the actual bottleneck for backlog clearing.
  // Quality is slightly lower than 70B but adequate for instruction-tuning pairs.
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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

  // Open a run record
  const { data: runRow } = await supa
    .from("conversion_runs")
    .insert({})
    .select("id")
    .single();
  const runId = runRow?.id;

  // Fetch unconverted intel with substantial summaries
  const { data: intelRows } = await supa
    .from("marketing_intel")
    .select("id, category, title, url, summary")
    .eq("converted_to_training", false)
    .not("summary", "is", null)
    .gte("scraped_at", new Date(Date.now() - 60 * 86400000).toISOString())
    .order("scraped_at", { ascending: false })
    .limit(limit);

  const rows = intelRows ?? [];
  let pairsCreated = 0;
  let pairsSkipped = 0;

  for (const row of rows) {
    try {
      const summary = (row.summary ?? "").slice(0, 1500);
      if (summary.length < 200) {
        pairsSkipped++;
        continue;
      }
      const pairs = await generatePairs(groq, row.category, row.title, summary);
      for (const p of pairs) {
        const { error } = await supa.from("training_pairs").insert({
          intel_id: row.id,
          intent: row.category,
          instruction: p.instruction,
          output: p.output,
          source_url: row.url,
          source_title: row.title,
          quality: 1.0,
        });
        if (!error) pairsCreated++;
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
  });
}
