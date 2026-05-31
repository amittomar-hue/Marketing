import OpenAI from "openai";
import { NextRequest } from "next/server";
import { tavilySearch, formatTavilyForContext } from "@/lib/tavily";
import { classifyIntent } from "@/lib/supabase";
import {
  logInteraction,
  retrieveExamples,
  formatExamplesAsContext,
  retrieveNegativePatterns,
  formatNegativePatternsAsContext,
} from "@/lib/learning";
import { hfStreamGenerate, isFineTunedModelConfigured } from "@/lib/huggingface";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getLatestIntel, formatIntelAsContext } from "@/lib/intel";

export const runtime = "nodejs";
export const maxDuration = 60;

const GROQ_MODEL_MAP: Record<string, string> = {
  "dmoop-apex": "llama-3.3-70b-versatile",
  "dmoop-core": "llama-3.3-70b-versatile",
  "dmoop-pulse": "llama-3.1-8b-instant",
  // Tuned routes to 8B by default — different TPM bucket from Apex/Core (no 429 conflict),
  // and the heavy RLMO examples context does the specialization.
  "dmoop-tuned": "llama-3.1-8b-instant",
};

const TUNED_SYSTEM_PROMPT = `You are DMOOP Tuned — the self-learning variant of DMOOP. You specialize in marketing tasks by learning from your team's own approved high-rated responses, which are injected into your context as 'High-rated past examples'.

Your behavior contract:
- Lean HEAVILY on the high-rated past examples. They represent the user's brand voice, depth, and quality bar. Match or exceed their style.
- If past examples are present for the intent, model your response structure, tone, and depth on them.
- Be opinionated. The past examples have a perspective — adopt and extend it.
- If no examples exist for this intent, say so briefly and produce a baseline response that future feedback can shape.
- You still get web search and intel context, but the past examples are your strongest signal.
- Format responses in clean markdown with bold section headers and structured bullet lists.
- Never refer to yourself as "Marketing LLM" or any other name. You are DMOOP Tuned.`;

const SYSTEM_PROMPT = `You are DMOOP, an enterprise-grade marketing intelligence platform powered by real-time web research and a self-learning feedback loop. You serve marketing teams at mid-market and enterprise brands.

You are NOT limited to a fixed list of tasks. You handle the full surface area of modern B2B and B2C marketing including, but not limited to:

— Content & Creative —
Ad copy (Google, Meta, LinkedIn, TikTok, programmatic, OOH, retail media), email sequences, landing pages, blog/SEO content, video scripts, podcast outlines, social posts, sales enablement collateral, brand voice scoring, copy editing, taglines, naming.

— Strategy & Planning —
GTM strategy, positioning, ICP definition, messaging frameworks (JTBD, StoryBrand, etc.), launch playbooks, channel mix optimization, budget allocation, OKR design, brand architecture, pricing & packaging narratives, category creation.

— Search ecosystem (SEO / AEO / GEO) —
Technical SEO audits, keyword research, content gap analysis, internal linking strategy, schema markup, Core Web Vitals fixes, AEO (Answer Engine Optimization for Google AI Overviews / SGE / Bing Copilot), GEO (Generative Engine Optimization — getting cited by ChatGPT, Claude, Perplexity, Gemini), entity SEO, programmatic SEO, link building strategy, local SEO.

— Account-Based Marketing (ABM) —
Tier-1 account research, account plans, personalized outreach sequences, multi-thread strategies, intent data interpretation, signal-based triggers, ICP scoring, 6-stage account journeys, ABM campaign orchestration across email + LinkedIn + paid + direct mail.

— Signal Intelligence —
Buyer intent signal analysis (technographic, firmographic, behavioral), company-level signal tracking (hiring, funding, leadership changes, tech stack shifts, M&A, product launches), social listening, third-party intent data interpretation (Bombora, G2, 6sense, Demandbase), predictive lead scoring, propensity modeling.

— Online Reputation Management (ORM) —
Brand sentiment monitoring, review response strategies, crisis communications, executive thought leadership, employee advocacy, citation cleanup, Wikipedia/Wikidata strategy, defamation response, PR amplification.

— Demand & Pipeline —
Demand generation programs, pipeline acceleration, funnel diagnostics, attribution modeling (MMM, MTA, incrementality), CAC/LTV math, cohort analysis, referral programs, partner marketing, channel/affiliate strategy.

— Competitive & Market Intelligence —
Competitor teardowns, win/loss analysis, market sizing (TAM/SAM/SOM), category analysis, share of voice tracking, positioning matrices, alternative-to plays, displacement campaigns.

— Customer Marketing & Lifecycle —
Onboarding flows, activation campaigns, retention strategies, expansion plays, NPS / CSAT improvement, customer advocacy programs, case study production, community building, customer journey mapping.

— Analytics & Operations —
Marketing analytics setup, dashboards, KPI definition, MarTech stack design, marketing operations playbooks, lead routing, lifecycle stage definition, marketing automation flows, CDP strategy, data quality audits, privacy compliance (GDPR, CCPA, CASL).

If a user asks for something outside this list but it is a legitimate marketing task — do it. Marketing is a vast surface and you should handle whatever is asked with the same depth and specificity as the categories above.

Behavior rules:
- When provided "Web search results" context, treat those URLs as the source of truth. Cite inline as [1], [2], etc. End the message with a Sources section listing each URL.
- When provided "high-rated past examples" context, learn their structure, depth, and tone — do not copy verbatim. Match or exceed their quality.
- Be direct, specific, and data-driven. Lead with the recommendation, then the rationale.
- Use concrete numbers, named tools, named frameworks, and named playbooks whenever possible.
- Format responses in clean markdown with bold section headers and structured bullet lists.
- Never refer to yourself as "Marketing LLM" or any other name. You are DMOOP.`;

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

function looksLikeWebQuery(text: string): boolean {
  if (text.length < 5) return false;
  return true;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages: ClientMessage[] = body.messages ?? [];
  const modelId: string = body.model ?? "dmoop-core";
  const sessionId: string | undefined = body.session_id;
  const webSearchMode: "auto" | "on" | "off" = body.web_search_mode ?? "auto";

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return new Response(
      JSON.stringify({ error: "GROQ_API_KEY is not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userQuery = lastUser?.content ?? "";
  const intent = classifyIntent(userQuery);

  // Identify the authenticated user (if any)
  let userId: string | null = null;
  let userEmail: string | null = null;
  try {
    const supa = await createSupabaseServerClient();
    const { data: { user } } = await supa.auth.getUser();
    userId = user?.id ?? null;
    userEmail = user?.email ?? null;
  } catch {}

  // ── Web search context ─────────────────────────────────────
  let webContext = "";
  let webUsed = false;
  const shouldSearch =
    webSearchMode === "off"
      ? false
      : webSearchMode === "on"
      ? !!process.env.TAVILY_API_KEY && userQuery.length >= 3
      : !!process.env.TAVILY_API_KEY && looksLikeWebQuery(userQuery);
  if (shouldSearch) {
    try {
      const tavily = await tavilySearch(userQuery);
      webContext = formatTavilyForContext(tavily);
      webUsed = true;
    } catch (err) {
      webContext = `(Web search unavailable: ${
        err instanceof Error ? err.message : "unknown error"
      })`;
    }
  }

  // ── Decide model-specific behavior ────────────────────────────
  // Map any legacy model IDs to DMOOP defaults
  const effectiveModelIdEarly = (modelId in GROQ_MODEL_MAP || modelId === "dmoop-tuned")
    ? modelId
    : "dmoop-core";
  const isTuned = effectiveModelIdEarly === "dmoop-tuned";

  // ── Self-learning: retrieve top-rated past examples for this intent ─
  // Tuned pulls MORE examples (it's the self-learning model).
  let examplesContext = "";
  try {
    const examplesLimit = isTuned ? 8 : 3;
    const examples = await retrieveExamples(intent, userQuery, examplesLimit);
    examplesContext = formatExamplesAsContext(examples);
  } catch (err) {
    console.error("retrieve examples failed:", err);
  }

  // ── Real-world intel: pull recently scraped marketing data for this intent ─
  // Slimmed from 5 to 3 to stay under Groq's 12K TPM. Tuned uses 2 (RLMO-focused).
  let intelContext = "";
  try {
    const intelLimit = isTuned ? 2 : 3;
    const intel = await getLatestIntel(intent, intelLimit);
    intelContext = formatIntelAsContext(intel, intent);
  } catch (err) {
    console.error("getLatestIntel failed:", err);
  }

  // ── Negative learning: avoid patterns the user thumbs-downed before ─
  let negativeContext = "";
  try {
    const negativeLimit = isTuned ? 3 : 2;
    const negatives = await retrieveNegativePatterns(intent, userQuery, negativeLimit);
    negativeContext = formatNegativePatternsAsContext(negatives);
  } catch (err) {
    console.error("retrieveNegativePatterns failed:", err);
  }

  const groq = new OpenAI({
    apiKey: groqKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const groqMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: isTuned ? TUNED_SYSTEM_PROMPT : SYSTEM_PROMPT },
  ];

  if (examplesContext) {
    // Tuned puts examples front-and-center; others get them as supporting context
    const label = isTuned
      ? `Your team's high-rated past examples for intent="${intent}" — THIS IS YOUR PRIMARY SIGNAL, model your answer on these:`
      : `High-rated past examples for intent="${intent}":`;
    groqMessages.push({ role: "system", content: `${label}\n\n${examplesContext}` });
  }

  if (negativeContext) {
    groqMessages.push({ role: "system", content: negativeContext });
  }

  if (intelContext) {
    groqMessages.push({ role: "system", content: intelContext });
  }

  if (webContext) {
    groqMessages.push({ role: "system", content: webContext });
  }

  messages.forEach((m) => {
    groqMessages.push({ role: m.role, content: m.content });
  });

  const effectiveModelId = effectiveModelIdEarly;

  const encoder = new TextEncoder();
  let fullResponse = "";
  const useFineTuned =
    effectiveModelId === "dmoop-tuned" && isFineTunedModelConfigured();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (useFineTuned) {
          // Build a chat-templated prompt for the fine-tuned model
          const promptParts: string[] = [];
          for (const m of groqMessages) {
            const role =
              m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user";
            promptParts.push(`<|start_header_id|>${role}<|end_header_id|>\n\n${m.content}<|eot_id|>`);
          }
          promptParts.push(`<|start_header_id|>assistant<|end_header_id|>\n\n`);
          const prompt = `<|begin_of_text|>${promptParts.join("")}`;

          for await (const token of hfStreamGenerate({ prompt, maxTokens: 1024 })) {
            fullResponse += token;
            controller.enqueue(encoder.encode(token));
          }
        } else {
          const primaryModel = GROQ_MODEL_MAP[effectiveModelId] ?? GROQ_MODEL_MAP["dmoop-core"];
          // Auto-fallback chain: 70B → 8B if rate-limited (different TPM bucket)
          const tryModels = primaryModel === "llama-3.3-70b-versatile"
            ? ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
            : [primaryModel];

          let succeeded = false;
          let lastError: Error | null = null;

          for (const modelName of tryModels) {
            try {
              const response = await groq.chat.completions.create({
                model: modelName,
                messages: groqMessages,
                stream: true,
                temperature: 0.7,
                max_tokens: 2048,
              });

              for await (const chunk of response) {
                const token = chunk.choices[0]?.delta?.content;
                if (token) {
                  fullResponse += token;
                  controller.enqueue(encoder.encode(token));
                }
              }
              succeeded = true;
              break;
            } catch (err: unknown) {
              lastError = err instanceof Error ? err : new Error(String(err));
              const isRateLimit = lastError.message.includes("429") || lastError.message.toLowerCase().includes("rate");
              // Only attempt fallback for 429s; for other errors, throw immediately
              if (!isRateLimit) throw lastError;
              // Otherwise: continue to next model in chain
            }
          }

          if (!succeeded && lastError) throw lastError;
        }

        // Log this interaction for learning (best-effort, non-blocking failure)
        const interactionId = await logInteraction({
          user_query: userQuery,
          intent,
          response: fullResponse,
          model: modelId,
          web_search_used: webUsed,
          session_id: sessionId,
          user_id: userId ?? undefined,
          user_email: userEmail ?? undefined,
        });

        // Emit interaction ID as a trailer so the client can attach feedback to it
        if (interactionId) {
          controller.enqueue(
            encoder.encode(`\n\n<!-- interaction_id:${interactionId} -->`)
          );
        }

        controller.close();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`\n\n⚠️ ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
