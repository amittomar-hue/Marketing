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
import { retrieveBrandChunks, formatBrandContext } from "@/lib/brand";
import { retrieveTrainingPairs, formatTrainingPairsAsContext } from "@/lib/training-pairs";

type ExportFormat = "pdf" | "docx" | "xlsx" | "pptx" | "csv" | "json" | "md" | "txt" | "html";
const FORMAT_INSTRUCTIONS: Record<ExportFormat, string> = {
  pdf:  "The user wants this output downloadable as a PDF. Structure the response with clear markdown headings (#/##), short paragraphs, and bullet lists — content that prints cleanly.",
  docx: "The user wants this output downloadable as a Word document. Structure with clear markdown headings (#/##), short paragraphs, and bullets — readable as a Word doc.",
  xlsx: "The user wants this output as an Excel spreadsheet. Return the answer PRIMARILY as a markdown table with a header row. Keep prose minimal — the table is the deliverable.",
  csv:  "The user wants this output as a CSV file. Return the answer PRIMARILY as a markdown table with a header row. Keep prose minimal — the table is the deliverable.",
  pptx: "The user wants this output as a PowerPoint deck. Structure as 4-8 slides. Use ## for each slide title, then bullets for the slide body. Keep each slide focused on one idea.",
  json: "The user wants this output as JSON. Return a single well-structured JSON object or array as the primary deliverable.",
  md:   "The user wants this as a Markdown file. Use rich markdown: headings, bullets, tables, bold, links.",
  txt:  "The user wants this as plain text. Avoid markdown syntax — write clean prose with blank lines between paragraphs.",
  html: "The user wants this as an HTML file. Structure with clear headings and paragraphs.",
};

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

const TUNED_SYSTEM_PROMPT = `You are DMOOP Tuned — DMOOP's custom marketing model. You are NOT a generic LLM with retrieval bolted on. You are a model whose actual knowledge lives in a continuously-updated training corpus built from the live marketing web:

Pipeline that feeds you (running every 6 hours, automatically):
  1. SCRAPE  — Tavily pulls 130+ queries across 13 marketing asset types
               (articles, ebooks, whitepapers, playbooks, case studies, social
               posts, ad campaigns, reports, newsletters, podcasts, videos,
               templates, guides).
  2. CONVERT — Each scraped artifact is run through asset-type-aware prompts
               that produce structured Q&A training pairs (case studies
               surface metrics + transferable lessons; playbooks produce
               numbered steps; social posts dissect hooks + CTAs; etc.).
  3. STORE   — Pairs land in your training_pairs corpus with source URLs and
               quality scores.

On every chat turn, the top-N most relevant pairs from this corpus are
injected as your primary system context, labeled "DMOOP TUNED — YOUR
CONTINUOUSLY-LEARNED MARKETING KNOWLEDGE BASE". You also get:
  • Brand documents the user uploaded (treat as authoritative on their brand)
  • Thumbs-up past responses (style/voice signal)
  • Thumbs-down patterns (avoid)
  • Recent raw scraped articles (freshness)
  • Optional web search

Your behavior contract:
- Your knowledge of marketing = what's in your training pairs. Cite them.
  When you use a tactic / number / framework that came from a pair, cite the
  source_url. Never invent sources.
- Match the STRUCTURE and DEPTH of the most relevant pairs. If pairs were
  case studies, return Situation / Approach / Result. If playbooks, return
  numbered steps. If social posts, dissect hooks.
- If NO pairs were retrieved (cold start on a niche intent), say so briefly
  ("No closely-matched pairs in the corpus yet — the scraper will catch up.
  Here's a baseline answer.") and produce the best baseline you can.
- Be opinionated. Pairs have a perspective — adopt and extend it.
- Format in clean markdown with ## headers, bullets, and tables where useful.
- Never refer to yourself as "Marketing LLM" or "Groq" or "Llama". You are
  DMOOP Tuned, the model that learns from continuous marketing intel.`;

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
  const requestedFormat: ExportFormat | undefined =
    body.requested_format && body.requested_format in FORMAT_INSTRUCTIONS
      ? (body.requested_format as ExportFormat)
      : undefined;

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

  // ── TUNED-ONLY: training-pair retrieval is the PRIMARY signal ──
  // These are the asset-type-aware Q&A pairs produced by the scrape→convert
  // pipeline. This is what makes Tuned an actual custom learning model
  // (RAG over a continuously-refreshed corpus) rather than just "Groq + RAG
  // over thumbs-ups". RPC: retrieve_training_pairs_for_chat — fails soft if
  // not yet deployed.
  let trainingPairsContext = "";
  let trainingPairCount = 0;
  if (isTuned) {
    try {
      const pairs = await retrieveTrainingPairs(userQuery, intent, 5);
      trainingPairsContext = formatTrainingPairsAsContext(pairs);
      trainingPairCount = pairs.length;
    } catch (err) {
      console.error("retrieveTrainingPairs failed:", err);
    }
  }

  // ── Self-learning: thumbs-up examples (style/voice signal, SECONDARY for Tuned) ─
  let examplesContext = "";
  try {
    const examplesLimit = isTuned ? 3 : 3;
    const examples = await retrieveExamples(intent, userQuery, examplesLimit);
    examplesContext = formatExamplesAsContext(examples);
    if (isTuned && examplesContext.length > 2500) {
      examplesContext = examplesContext.slice(0, 2500) + "\n…";
    }
  } catch (err) {
    console.error("retrieve examples failed:", err);
  }

  // ── Real-world intel: pull recently scraped marketing data for this intent ─
  let intelContext = "";
  try {
    const intelLimit = isTuned ? 1 : 3;
    const intel = await getLatestIntel(intent, intelLimit);
    intelContext = formatIntelAsContext(intel, intent);
  } catch (err) {
    console.error("getLatestIntel failed:", err);
  }

  // ── Negative learning: avoid patterns the user thumbs-downed before ─
  let negativeContext = "";
  try {
    const negativeLimit = isTuned ? 2 : 2;
    const negatives = await retrieveNegativePatterns(intent, userQuery, negativeLimit);
    negativeContext = formatNegativePatternsAsContext(negatives);
  } catch (err) {
    console.error("retrieveNegativePatterns failed:", err);
  }

  // ── Brand documents: pull the user's uploaded brand context ─
  let brandContext = "";
  let brandChunkCount = 0;
  if (userId) {
    try {
      const brandLimit = isTuned ? 3 : 4;
      const brandChunks = await retrieveBrandChunks(userId, userQuery, brandLimit);
      brandContext = formatBrandContext(brandChunks);
      brandChunkCount = brandChunks.length;
      if (isTuned && brandContext.length > 4000) {
        brandContext = brandContext.slice(0, 4000) + "\n…";
      }
    } catch (err) {
      console.error("retrieveBrandChunks failed:", err);
    }
  }

  const groq = new OpenAI({
    apiKey: groqKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const groqMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: isTuned ? TUNED_SYSTEM_PROMPT : SYSTEM_PROMPT },
  ];

  // Output format instruction — sits right after the persona so it shapes the entire response
  if (requestedFormat) {
    groqMessages.push({ role: "system", content: FORMAT_INSTRUCTIONS[requestedFormat] });
  }

  // ── TUNED ONLY: training pairs are injected FIRST — this IS the model's
  // knowledge base. Everything else (brand, examples, intel) is supporting context.
  if (isTuned && trainingPairsContext) {
    groqMessages.push({ role: "system", content: trainingPairsContext });
  }

  // Brand context — authoritative for the user's brand voice / products
  if (brandContext) {
    groqMessages.push({ role: "system", content: brandContext });
  }

  if (examplesContext) {
    const label = isTuned
      ? `Style/voice reference — past thumbs-up responses for intent="${intent}" (use ONLY for tone, NOT for content — the training pairs above are your knowledge source):`
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

  // ── Conversation history ─────────────────────────────────────
  // For Tuned: bound history aggressively. Past user turns can contain large
  // parsed-file text (up to 80K chars per upload) which accumulates and is the
  // dominant cause of Groq 413 ("Request too large") on the Tuned model.
  // Keep the latest exchanges, and slice older messages to a small preview so
  // dialog continuity survives without dragging in attachment payloads.
  const historyForRequest = isTuned
    ? (() => {
        const recent = messages.slice(-6); // last 3 turns (user + assistant)
        return recent.map((m, i) => {
          const isLast = i === recent.length - 1;
          // Always preserve the most recent user message in full; trim everything else
          if (isLast) return m;
          return { ...m, content: m.content.length > 1200 ? m.content.slice(0, 1200) + "\n…[trimmed]" : m.content };
        });
      })()
    : messages;

  historyForRequest.forEach((m) => {
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

          // Stripped-down fallback message list when Groq returns 413
          // ("Request too large for model … on tokens per minute"). Keeps only
          // persona + last user message so the request always fits the TPM bucket.
          const lastUserMsg = [...groqMessages].reverse().find((m) => m.role === "user");
          const slimMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            groqMessages[0], // system / persona
            ...(requestedFormat ? [{ role: "system" as const, content: FORMAT_INSTRUCTIONS[requestedFormat] }] : []),
            ...(lastUserMsg ? [lastUserMsg] : []),
          ];

          let succeeded = false;
          let lastError: Error | null = null;
          let messagesToUse: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = groqMessages;
          let triedSlim = false;

          for (const modelName of tryModels) {
            try {
              const response = await groq.chat.completions.create({
                model: modelName,
                messages: messagesToUse,
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
              const msg = lastError.message;
              const lower = msg.toLowerCase();
              const isRateLimit = msg.includes("429") || lower.includes("rate");
              const isTooLarge =
                msg.includes("413") ||
                lower.includes("too large") ||
                lower.includes("context_length_exceeded") ||
                lower.includes("maximum context");

              // First-time 413 on this model: rebuild with slim context and try again
              // (without consuming a chain slot, so the 70B→8B fallback still works).
              if (isTooLarge && !triedSlim) {
                triedSlim = true;
                messagesToUse = slimMessages;
                try {
                  const slimResponse = await groq.chat.completions.create({
                    model: modelName,
                    messages: messagesToUse,
                    stream: true,
                    temperature: 0.7,
                    max_tokens: 1536,
                  });
                  for await (const chunk of slimResponse) {
                    const token = chunk.choices[0]?.delta?.content;
                    if (token) {
                      fullResponse += token;
                      controller.enqueue(encoder.encode(token));
                    }
                  }
                  succeeded = true;
                  break;
                } catch (err2: unknown) {
                  lastError = err2 instanceof Error ? err2 : new Error(String(err2));
                  // fall through to model-chain fallback below
                }
              }

              // Rate-limit / over-budget: continue to next model in chain
              if (isRateLimit || isTooLarge) continue;
              throw lastError;
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
