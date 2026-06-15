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
import { formatVoiceProfileForContext, type VoiceProfile } from "@/lib/voice-profile";
import { getSupabase } from "@/lib/supabase";
import {
  planResearch,
  encodeIntentMarker,
  encodeStepMarker,
  RESEARCH_DONE_MARKER,
  type ResearchStep,
} from "@/lib/research-planner";
import { tavilySearch as researchSearch, formatTavilyForContext as formatResearchForContext } from "@/lib/tavily";
import { retrieveTrainingPairs, formatTrainingPairsAsContext } from "@/lib/training-pairs";
import { extractUrlsFromText, scrapeSite, formatScrapeAsContext } from "@/lib/web-scraper";
import {
  moderateText,
  detectPromptInjection,
  logSafetyIncident,
  refusalForUnsafeInput,
  refusalForUnsafeOutput,
  refusalForInjection,
} from "@/lib/safety";

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
  // Tuned: llama-4-scout-17b has the highest free-tier TPM (30K vs 6K on 8B-instant),
  // which is what we actually need given training-pair + brand context payload.
  // Fallback chain below tries scout → kimi-k2 (10K TPM) → 8B-instant.
  "dmoop-tuned": "meta-llama/llama-4-scout-17b-16e-instruct",
};

// Per-model fallback chains. Ordered by TPM headroom so we degrade gracefully
// under rate-limit / over-budget conditions instead of erroring out.
const FALLBACK_CHAIN: Record<string, string[]> = {
  "llama-3.3-70b-versatile": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  "llama-3.1-8b-instant": ["llama-3.1-8b-instant"],
  "meta-llama/llama-4-scout-17b-16e-instruct": [
    "meta-llama/llama-4-scout-17b-16e-instruct", // 30K TPM
    "moonshotai/kimi-k2-instruct",               // 10K TPM
    "llama-3.1-8b-instant",                      // 6K TPM — last resort
  ],
};

// Shared depth + format contract — applies to BOTH personas. Repeating this
// in every system prompt is expensive but vagueness/output-shape is the #1
// complaint we're fixing, so it earns its tokens.
const DEPTH_AND_FORMAT_CONTRACT = `
CLARIFY-OR-COMMIT CONTRACT (read first — applies to every answer):
- The single biggest cause of vague marketing answers is a prompt that lacks anchors. If the user's question is missing 2+ of (audience / product / channel / goal / constraint), DO NOT default to generic AI prose. Instead, do ONE of:
  (A) Ask ONE focused clarifying question — never more than one — that unlocks the answer. Format it as a single line at the very top, prefixed with "▶ Quick clarify:" then give what you'd do under each of 2-3 plausible interpretations as a fallback.
  (B) Pick the most likely interpretation, state it explicitly ("Assuming you mean B2B SaaS targeting Series A-B founders…"), and commit to a specific answer for that case.
- Never use option (A) more than once per response. Never use it if the user has already specified audience + channel + product. Never use it as an excuse to avoid answering.
- When asked an unanswerable question without context, REFUSE to invent numbers. Say "I don't have a specific benchmark for this — the industry-typical range is roughly X–Y. Share your current number and I'll calibrate." instead of stating a fake stat as fact.

DEPTH CONTRACT (non-negotiable):
- NEVER answer in vague generalities. Every answer must include AT LEAST FIVE of:
  • Specific numbers / benchmarks / % lifts (only when you actually have a source — never invent)
  • Named tools (e.g. 6sense, Bombora, Clearbit, Apollo, Mutiny, Demandbase, GA4, Looker, HubSpot)
  • Named frameworks (e.g. JTBD, StoryBrand, Pirate Metrics, RACE, Bowtie, MEDDIC)
  • Named playbooks / motions (e.g. PLG, sales-led, ABM tier-1, signal-based outbound)
  • Concrete examples from real companies (cite — never make up case studies)
  • Step-by-step tactics with channels + timing
  • Source URLs from your context (cite inline as [1], [2])
- If a number is missing from your context, label your estimate "[industry-typical range — verify against your data]" rather than presenting a guess as fact.
- Lead with the answer or recommendation, THEN the rationale.

BANNED PHRASES (use of any of these signals you've defaulted to generic AI prose):
- "leverage", "synergy", "robust solution", "cutting-edge", "innovative approach"
- "in today's fast-paced world", "in an ever-evolving landscape"
- "best practices include" — name the practices instead
- "consider implementing" — say WHAT to implement
- "various strategies" / "a variety of approaches" — name them
- "tailored solutions" / "customized approach" — define the customization
If you catch yourself reaching for one of these, stop and write the specific version instead.

FORMAT CONTRACT (every answer):
1. Lead with the answer. No preamble, no TL;DR, no "great question" — first sentence does work.
2. ## Section headings for each major part of the answer.
3. Bulleted or numbered lists for tactics, steps, or comparisons.
4. **Use tables** for any comparison (3+ options, before/after, channel mix).
5. **Bold** key terms and numbers inline.
6. Use > blockquotes for verbatim quotes from sources.
7. End with **## Next 3 actions** — three specific things the user should do this week, in order.
8. If web search / training pairs / intel context was provided, end with **## Sources** listing each [n] → URL.

FRESHNESS CONTRACT:
- "Latest" / "best" / "current" / "trending" → cite sources with dates. If a tactic was hot in 2022 but stale in 2026, say so.
- When the user asks about strategy/tactics: prefer references from the last 12 months.
- Never present pre-2024 data as "current" without flagging it.

CREATIVE-vs-REPORTING CONTRACT — this is critical, do not miss it:
- If the user asks you to "give me", "write", "draft", "create", "generate", "produce" — they want ORIGINAL CREATIVE READY TO PUBLISH. Output the actual posts/copy/emails/scripts themselves, formatted as final assets. RESEARCH FINDINGS are inspiration / context — do NOT regurgitate them as a list of "what's viral right now". The user already knows what's viral; they need YOU to produce the next thing that will be.
- Example of WRONG (do not do this): user asks "give me 5 viral social posts" → you list 5 posts that already went viral with their view counts. That's a trend report, not creative.
- Example of RIGHT: user asks "give me 5 viral social posts" → you write 5 ready-to-publish social posts, each with: hook, body, CTA, suggested platform, optional asset note. Use what you read in research findings to inform the angle, format, and what's working — but the output is YOUR original copy, not their copy.
- If the user explicitly asks for a roundup / trend report / "what's trending" / "what's working in the market", THEN summarize what others are doing. Otherwise, default to producing the asset.

VISUAL CREATIVE CONTRACT — when producing social posts, ads, landing-page hero copy, or any asset where a visual would normally accompany the copy, INCLUDE a generated image inline using DMOOP's image proxy:
- Format: \`![Short alt describing the visual](/api/imagegen?prompt={URL-ENCODED detailed visual description}&width=1024&height=1024&seed={small integer for variety})\`
- The endpoint is /api/imagegen — a RELATIVE URL on this site, NOT pollinations.ai or any external host. Do NOT use https://image.pollinations.ai/ — it has been paywalled and will not load.

CRITICAL — EMIT, DO NOT NARRATE: You MUST emit the markdown image syntax literally — \`![alt](/api/imagegen?prompt=...)\` — not a sentence describing that you generated an image. The Markdown renderer in the chat fetches the URL and displays the image. There is no "send" action. There is no separate channel. The ONLY way an image appears for the user is if you write the literal characters \`![\` followed by alt text, \`]\`, \`(\`, the URL, and \`)\` directly into your response body, in markdown.

BANNED PHRASES (these mean you forgot to emit the markdown — fix it):
- "I generated and sent you an image..."
- "Here's an image: ..."
- "I created a visual showing..."
- "Image: [description]"
- "Generated image attached"
- Any sentence that DESCRIBES creating or sending an image instead of producing the \`![](...)\` syntax

CORRECT EXAMPLE — copy this exact shape:
\`\`\`
**Visual:**
![Candid portrait of a Black woman software engineer in her 30s at a sunlit standing desk, mid-laugh](/api/imagegen?prompt=Candid%20portrait%20of%20a%20Black%20woman%20software%20engineer%20in%20her%2030s%20at%20a%20sunlit%20standing%20desk%2C%20mid-laugh%2C%20glasses%2C%20casual%20button-up%20shirt%2C%20plants%20behind%20her%2C%20professional%20photography%2C%20real%20people%2C%20natural%20lighting%2C%20sharp%20focus%2C%20shot%20on%20Canon%20EOS%20R5%2C%2050mm%20lens%2C%20shallow%20depth%20of%20field%2C%20magazine%20editorial%20quality%2C%20modern%20corporate%20aesthetic%2C%20authentic%20expression%2C%20no%20text%2C%20no%20logos%2C%20no%20watermark&width=1024&height=1024&seed=42)
\`\`\`

If you find yourself typing "I generated" or "Here's an image" — STOP and replace it with the \`![](...)\` markdown directly.

VISUAL STYLE — PROFESSIONAL PHOTOGRAPHY OF REAL PEOPLE, NEVER 3D RENDER OR ILLUSTRATION:
- Every generated image MUST be a professional photograph of real-looking people in real-looking environments. Do NOT use words like "stylized", "3D render", "octane render", "cinema 4d", "illustration", "cartoon", "anime", "rendering", "CGI", "isometric", "flat", "vector", "doodle", "sketch", "watercolor", "oil painting", "pencil drawing" anywhere in the description. Those are banned style modifiers.
- ALWAYS include these photography modifiers explicitly in every description, comma-separated near the end: "professional photography, real people, candid portrait, natural lighting, sharp focus, shot on Canon EOS R5, 50mm lens, shallow depth of field, magazine editorial quality, modern corporate aesthetic, authentic expressions, diverse cast, no text, no logos, no watermark".
- People depicted MUST look like real human beings with realistic facial features, skin texture, hair, and clothing — not stylized characters. Examples of good subject framing: "professional woman in her late 30s wearing a navy blazer, smiling warmly at a colleague", "diverse team of professionals in a modern office, mid-conversation around a glass conference table", "remote worker at a sunlit home office, laptop open, holding a coffee mug, candid moment". Specificity in age range, attire, expression, and action produces grounded results.
- Settings should be plausible modern workplaces: airy offices with glass walls, sunlit home workstations, urban cafes with laptops, casual co-working spaces, conference rooms with natural light. Avoid generic stock-photo backgrounds; name the place.
- Composition still matters — name the scene, the camera angle (close-up portrait, mid-shot, over-the-shoulder, wide environmental), lighting (golden hour, soft window light, overcast diffused), mood. Generic descriptions ("a businessman", "a happy team") produce stock-photo slop. Specific scenes ("Candid portrait of a Black woman software engineer in her 30s at a sunlit standing desk, mid-laugh, glasses, casual button-up, plants behind her, shallow depth of field, shot on Canon R5, 50mm") produce something usable.
- Diversity is the default — across responses with multiple images, vary gender presentation, ethnicity, age (range 25-55 unless context demands otherwise), and body type. Do not default to white middle-aged men.

URL STRUCTURE — the prompt query parameter must contain the FULL description AS A SINGLE URL-ENCODED STRING, including the subject + setting + style modifiers + camera modifiers all together. Width / height / seed are SEPARATE query params that come AFTER the closing & of the prompt value. There are NEVER style modifiers, camera modifiers, or anything else outside the prompt= value. URL-encode spaces as %20, commas as %2C, & as %26 inside the prompt value so the link parses cleanly.
WRONG: \`![alt](/api/imagegen?prompt=A%20person%20at%20a%20desk&width=1024&height=1024&seed=42professional photography, Canon R5, 50mm)\` ← modifiers dumped after seed, unencoded, breaks the URL.
CORRECT: \`![alt](/api/imagegen?prompt=A%20person%20at%20a%20desk%2C%20professional%20photography%2C%20Canon%20EOS%20R5%2C%2050mm%20lens%2C%20natural%20lighting%2C%20shallow%20depth%20of%20field%2C%20magazine%20editorial%20quality&width=1024&height=1024&seed=42)\` ← every modifier inside the prompt value, URL-encoded; query params follow cleanly.

RELEVANCE — the image subject MUST relate to the marketing asset's content. If the asset is a fintech CFO cold email, depict B2B office / boardroom / financial professional contexts — NOT tourist scenes, NOT landscapes, NOT unrelated portraits. If you can't link the image subject to the asset's audience or topic in one sentence, you're picking the wrong subject. Re-read what you just wrote before composing the image prompt.
- URL-encode the description (spaces become %20, commas become %2C, etc.) so the link works.
- Width 1024 height 1024 for square social (LinkedIn, Instagram); 768×1344 for vertical (TikTok, Reels, Stories); 1344×768 for hero / landscape. Both must be multiples of 64 and the proxy clamps to a safe range.
- Vary the seed (any small integer 1-9999) per image in the same response so 5 posts don't all return the same generated image.
- ONE image per asset is enough — don't over-stack. The image is paired with the copy, not replacing it.
- Skip the image only for assets where it doesn't apply (cold emails without an attachment, plain copy snippets, single-line taglines).`;

const TUNED_SYSTEM_PROMPT = `You are DMOOP Tuned — DMOOP's custom marketing model. Your knowledge of marketing is the continuously-updated training corpus (scraped marketing intel → asset-type-aware Q&A pairs). The most relevant pairs are injected as system context labeled "DMOOP TUNED — KNOWLEDGE BASE".

KNOWLEDGE RULES:
- Training pairs are your primary source. Match their STRUCTURE (case study → Situation/Approach/Result; playbook → numbered steps; social post → hook+CTA breakdown).
- Cite source_url when you pull a tactic/number/framework from a pair (e.g. [1]).
- If no closely-matched pair: say so in one line and give the best grounded baseline (don't make up sources).
- Brand documents = authoritative on user's brand voice and product.
- Never call yourself Llama / Groq / Marketing LLM. You are DMOOP Tuned.
${DEPTH_AND_FORMAT_CONTRACT}`;

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

KNOWLEDGE RULES:
- When "Live web research" context is provided, treat those URLs as the source of truth — cite inline as [1], [2] and end with **## Sources** listing each URL with its publish date.
- When "high-rated past examples" / "training pairs" / "brand documents" are provided, learn their structure and depth — do NOT copy verbatim.
- Never refer to yourself as "Marketing LLM" or any other name. You are DMOOP.
${DEPTH_AND_FORMAT_CONTRACT}`;

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Extract retry-after seconds from a Groq / OpenAI-SDK error.
 *
 * Sources, in priority order:
 *   1. `error.headers['retry-after']` — set by the OpenAI SDK from the response.
 *   2. Body text patterns:
 *        "Please try again in 23.5s"          (per-minute window)
 *        "Please try again in 1h2m37s"        (per-day window)
 *        "Please try again in 12m45.123s"     (variant)
 */
function parseRetryAfterSeconds(err: Error): number | null {
  const e = err as Error & { headers?: Record<string, string | undefined> };
  const headerVal = e.headers?.["retry-after"];
  if (headerVal) {
    const asNum = Number(headerVal);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
  }

  const msg = err.message;

  // "Please try again in 1h2m37.5s" → 3757.5
  const compound = msg.match(/try again in\s+(?:(\d+)h)?(?:(\d+)m)?(\d+(?:\.\d+)?)s/i);
  if (compound) {
    const h = parseFloat(compound[1] ?? "0");
    const m = parseFloat(compound[2] ?? "0");
    const s = parseFloat(compound[3] ?? "0");
    const total = h * 3600 + m * 60 + s;
    if (total > 0) return total;
  }

  // Bare "in 47s"
  const seconds = msg.match(/try again in\s+(\d+(?:\.\d+)?)\s*s/i);
  if (seconds) return parseFloat(seconds[1]);

  return null;
}

/**
 * Pretty-print a relative duration: "47 seconds" / "4 minutes 12 seconds" /
 * "2 hours 18 minutes".
 */
function formatDuration(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.floor(s / 60);
  const remS = s - m * 60;
  if (m < 60) {
    return remS > 0 && m < 10 ? `${m}m ${remS}s` : `${m} minute${m === 1 ? "" : "s"}`;
  }
  const h = Math.floor(m / 60);
  const remM = m - h * 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h} hour${h === 1 ? "" : "s"}`;
}

/**
 * Build the user-facing "free quota exhausted, come back later" message.
 * Emits an ISO `comeback_at` HTML comment that the client can format in the
 * user's local timezone if it wants — the human-readable text is also included
 * inline so older clients still render something useful.
 */
function buildQuotaExhaustedMessage(err: Error, isTuned: boolean): string {
  const modelLabel = isTuned ? "DMOOP Tuned" : "DMOOP";
  const retrySec = parseRetryAfterSeconds(err);

  // No retry-after info at all → safe default of 60s.
  // Heuristic: any retry-after > 30 minutes is treated as the daily quota.
  const effective = retrySec ?? 60;
  const comeback = new Date(Date.now() + effective * 1000);
  const comebackIso = comeback.toISOString();
  const comebackUtc = comeback.toUTCString().replace(/^[A-Za-z]+, /, "").replace(" GMT", " UTC");
  const isDaily = effective > 30 * 60;

  const headline = isDaily
    ? `🪫 **${modelLabel} — free daily quota exhausted**`
    : `⏳ **${modelLabel} — free token window exhausted**`;

  const lines: string[] = [
    headline,
    "",
    isDaily
      ? `Your free-tier daily allowance has run out for today.`
      : `You've used up the per-minute free token budget on this model.`,
    "",
    `**Come back in:** ${formatDuration(effective)}`,
    `**Come back at:** ${comebackUtc}`,
    "",
    `In the meantime, you can switch to **Apex** or **Core** from the model selector — they use a separate quota and are available right now.`,
    // Hidden marker so the client can re-render the absolute time in the
    // viewer's local timezone if it wants (Markdown comment is invisible).
    `[//]: # (comeback_at:${comebackIso})`,
  ];

  return lines.join("\n");
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
  // Multi-agent: optional agent_id pin from the client; when absent,
  // retrieveBrandChunks falls back to the user's default agent via the
  // RPC. Validated/scoped by the RPC against user_id so a malicious
  // client can't read another user's chunks even with a guessed id.
  const conversationAgentId: string | null = body.agent_id ?? null;
  // Image generation controls — surfaced as toggle + style picker in the
  // InputBar. When mode === "off" we append a system override telling
  // the model to skip the VISUAL CREATIVE CONTRACT entirely; when style
  // differs from the prompt's baked-in "photo" default we append a
  // style override block redirecting the modifier trailer.
  const imageMode: "on" | "off" = body.image_mode === "off" ? "off" : "on";
  const imageStyle: "photo" | "3d" | "illustration" =
    body.image_style === "3d" ? "3d" :
    body.image_style === "illustration" ? "illustration" :
    "photo";
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

  // ── SAFETY: input guardrails (run in parallel to minimize latency) ──
  // Llama Guard 4 moderates the last user message + a regex/LLM-judge
  // classifier looks for prompt-injection attempts. If either flags,
  // we return a polished refusal instead of calling the main model.
  // isFollowUp = true once the conversation already has an assistant reply;
  // tells the injection detector to skip its over-zealous LLM judge layer
  // for in-conversation refinement requests like "shorter version" /
  // "translate to French" / "in US English". The regex layer still runs.
  const isFollowUp = messages.some((m) => m.role === "assistant" && m.content.trim().length > 0);
  const [inputModeration, injection] = await Promise.all([
    moderateText(userQuery, "user"),
    detectPromptInjection(userQuery, { isFollowUp }),
  ]);

  if (injection.detected) {
    await logSafetyIncident({
      kind: "prompt_injection",
      severity: injection.confidence === "high" ? "high" : "medium",
      categories: injection.patterns,
      excerpt: userQuery.slice(0, 500),
      action_taken: "blocked",
      user_id: userId,
      user_email: userEmail,
      model: modelId,
      metadata: { judge_used: injection.judgeUsed },
    });
    return new Response(refusalForInjection(injection.patterns), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (!inputModeration.safe) {
    await logSafetyIncident({
      kind: "input_unsafe",
      severity: "high",
      categories: inputModeration.categories,
      excerpt: userQuery.slice(0, 500),
      action_taken: "blocked",
      user_id: userId,
      user_email: userEmail,
      model: modelId,
    });
    return new Response(refusalForUnsafeInput(inputModeration.categories), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

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

  // ── Site scraper ─────────────────────────────────────────────
  // If the user mentioned a URL or bare domain, fetch the actual site
  // content (homepage + a handful of priority pages: about, products,
  // pricing, customers). The model then grounds on the REAL site text
  // instead of inventing claims or relying on Tavily snippets.
  let siteContext = "";
  const urlsInQuery = extractUrlsFromText(userQuery).slice(0, 1); // limit: 1 site per turn
  if (urlsInQuery.length > 0) {
    try {
      const scraped = await scrapeSite(urlsInQuery[0], 5);
      siteContext = formatScrapeAsContext(scraped);
    } catch (err) {
      siteContext = `(Site scrape unavailable for ${urlsInQuery[0]}: ${
        err instanceof Error ? err.message : "unknown"
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
      const brandChunks = await retrieveBrandChunks(userId, userQuery, brandLimit, conversationAgentId);
      brandContext = formatBrandContext(brandChunks);
      brandChunkCount = brandChunks.length;
      if (isTuned && brandContext.length > 4000) {
        brandContext = brandContext.slice(0, 4000) + "\n…";
      }
    } catch (err) {
      console.error("retrieveBrandChunks failed:", err);
    }
  }

  // ── Brand Voice Profile: pull the agent's structured voice profile
  // and inject as a permanent system-prompt addendum. Unlike brand
  // chunks (per-query similarity retrieval), the voice profile applies
  // to EVERY answer for this agent — tone / audience / preferred vocab
  // shape the response even when no individual brand doc matches the
  // user query. Resolution mirrors retrieveBrandChunks: explicit agent
  // first, else user's default agent. Cheap — one indexed SELECT.
  let voiceProfileContext = "";
  if (userId) {
    try {
      const service = getSupabase();
      if (service) {
        let q = service
          .from("brand_agents")
          .select("voice_profile")
          .eq("user_id", userId);
        q = conversationAgentId
          ? q.eq("id", conversationAgentId)
          : q.eq("is_default", true);
        const { data: agentRow } = await q.maybeSingle();
        const profile = (agentRow?.voice_profile as VoiceProfile | null) ?? null;
        voiceProfileContext = formatVoiceProfileForContext(profile);
      }
    } catch (err) {
      console.error("voice profile fetch failed:", err);
    }
  }

  const groq = new OpenAI({
    apiKey: groqKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  // Inject today's date so the model can reason about freshness ("as of today"
  // framing, flagging stale tactics, prioritizing recent context).
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dateInjection = `Current date: ${todayStr} (${now.toISOString().slice(0, 10)}). When the user says "latest"/"current"/"best of <year>", anchor on this date. Flag any data older than 12 months as potentially stale.`;

  const groqMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: isTuned ? TUNED_SYSTEM_PROMPT : SYSTEM_PROMPT },
    { role: "system", content: dateInjection },
  ];

  // Output format instruction — sits right after the persona so it shapes the entire response
  if (requestedFormat) {
    groqMessages.push({ role: "system", content: FORMAT_INSTRUCTIONS[requestedFormat] });
  }

  // ── HIGHEST PRIORITY: a URL the user explicitly asked us to look at.
  // Goes ABOVE training pairs because the user's intent is to ground on
  // THIS site specifically — pulling generic pairs first would be confusing.
  if (siteContext) {
    groqMessages.push({ role: "system", content: siteContext });
  }

  // ── TUNED: training pairs are injected next — this is the model's
  // knowledge base. Brand / examples / intel are supporting context.
  if (isTuned && trainingPairsContext) {
    groqMessages.push({ role: "system", content: trainingPairsContext });
  }

  // Brand Voice Profile — applies on every answer regardless of retrieval.
  // Pushed BEFORE brandContext so the model anchors on voice first, then
  // adapts that voice to whatever specific brand chunks were retrieved.
  if (voiceProfileContext) {
    groqMessages.push({ role: "system", content: voiceProfileContext });
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

  // ── User-controlled image generation overrides ──────────────────
  // The system prompt's VISUAL CREATIVE CONTRACT bakes in the default
  // ("photo" style, images ON). When the user flips the toggle off in
  // the InputBar, or picks 3D / Illustration from the style picker,
  // these system messages override the baseline for THIS turn only.
  // Pushed AFTER all context messages so they're the most recent
  // instructions the model sees — late-binding rules win in practice.
  if (imageMode === "off") {
    groqMessages.push({
      role: "system",
      content:
        "IMAGE OVERRIDE for this turn: Image generation is DISABLED. Do NOT emit any ![](...) markdown image tags, do NOT include /api/imagegen URLs, do NOT describe images you would have generated. Text-only response. The VISUAL CREATIVE CONTRACT is suspended for this turn.",
    });
  } else if (imageStyle === "3d") {
    groqMessages.push({
      role: "system",
      content: `VISUAL STYLE OVERRIDE for this turn: 3D render style.

URL STRUCTURE (read carefully — this is where the previous turn went wrong):
The prompt query parameter must contain the FULL description AS A SINGLE URL-ENCODED STRING, including both the subject description AND the style modifiers. ALL style modifiers go INSIDE the prompt= value, before the closing & that separates it from width/height/seed. There are NO style modifiers anywhere else in the URL.

Build the description as one sentence, then URL-encode the ENTIRE thing (spaces → %20, commas → %2C, & → %26), then put it as the value of prompt=. Width, height, and seed are SEPARATE query params and come AFTER the closing & of the prompt value.

WRONG (do not do this):
\`![alt](/api/imagegen?prompt=Subject%20description&width=1024&height=1024&seed=42stylized 3D render, octane render...)\`
   ↑ style modifiers dumped after seed, unencoded, breaks the URL completely

CORRECT (copy this shape exactly):
\`![3D scene of a B2B SaaS founder](/api/imagegen?prompt=Stylized%203D%20character%20of%20a%20B2B%20SaaS%20founder%20at%20a%20glowing%20desk%2C%20cinema%204d%2C%20octane%20render%2C%20soft%20global%20illumination%2C%20smooth%20matte%20surfaces%2C%20vivid%20color%20palette%2C%20depth%20of%20field%2C%20modern%20brand%20illustration%2C%20no%20text%2C%20no%20logos%2C%20no%20watermark&width=1024&height=1024&seed=42)\`
   ↑ EVERYTHING (subject + style modifiers) is one URL-encoded string inside prompt=, then &width=, &height=, &seed= follow

STYLE MODIFIERS TO INCLUDE (URL-encoded, comma-separated, inside the prompt value):
stylized 3D render, octane render, cinema 4d, soft global illumination, smooth matte surfaces, vivid color palette, depth of field, modern brand illustration, no text, no logos, no watermark

SUBJECTS as 3D characters with simplified features (not photorealistic people).
BANNED words: photo, photograph, photorealistic, candid portrait, real people, Canon EOS R5, 50mm lens, magazine editorial.
Aesthetic target: Stripe / Linear / modern SaaS brand illustration.

RELEVANCE — image subject MUST relate to the marketing asset content. If the asset is a fintech CFO cold email, the image must depict B2B office / boardroom / professional contexts — NOT tourist scenes, NOT landscapes, NOT unrelated portraits. If you can't link the image subject to the asset's audience or topic in one sentence, you're picking the wrong subject.`,
    });
  } else if (imageStyle === "illustration") {
    groqMessages.push({
      role: "system",
      content: `VISUAL STYLE OVERRIDE for this turn: Flat 2D illustration style.

URL STRUCTURE (read carefully — this is where the previous turn went wrong):
The prompt query parameter must contain the FULL description AS A SINGLE URL-ENCODED STRING, including both the subject description AND the style modifiers. ALL style modifiers go INSIDE the prompt= value, before the closing & that separates it from width/height/seed. There are NO style modifiers anywhere else in the URL.

Build the description as one sentence, then URL-encode the ENTIRE thing (spaces → %20, commas → %2C, & → %26), then put it as the value of prompt=. Width, height, and seed are SEPARATE query params and come AFTER the closing & of the prompt value.

WRONG (do not do this):
\`![alt](/api/imagegen?prompt=Subject%20description&width=1024&height=1024&seed=42flat 2D illustration, bold colors...)\`
   ↑ style modifiers dumped after seed, unencoded, breaks the URL completely

CORRECT (copy this shape exactly):
\`![Illustration of a remote team](/api/imagegen?prompt=Flat%202D%20illustration%20of%20a%20diverse%20remote%20team%20collaborating%20across%20a%20stylised%20world%20map%2C%20modern%20brand%20illustration%2C%20vibrant%20geometric%20shapes%2C%20bold%20flat%20colors%2C%20clean%20linework%2C%20minimalist%20composition%2C%20vector%20aesthetic%2C%20no%20gradients%2C%20no%20text%2C%20no%20logos%2C%20no%20watermark&width=1024&height=1024&seed=42)\`
   ↑ EVERYTHING (subject + style modifiers) is one URL-encoded string inside prompt=, then &width=, &height=, &seed= follow

STYLE MODIFIERS TO INCLUDE (URL-encoded, comma-separated, inside the prompt value):
flat 2D illustration, modern brand illustration, vibrant geometric shapes, bold flat colors, clean linework, minimalist composition, vector aesthetic, no gradients, no text, no logos, no watermark

SUBJECTS as simplified illustrated figures (not photorealistic people, not 3D-rendered).
BANNED words: photo, photograph, photorealistic, Canon EOS R5, 50mm lens, 3D, octane render, cinema 4d.
Aesthetic target: Mailchimp / Slack / Notion brand illustration.

RELEVANCE — image subject MUST relate to the marketing asset content. If the asset is a fintech CFO cold email, the image must depict B2B office / boardroom / professional contexts — NOT tourist scenes, NOT landscapes, NOT unrelated portraits. If you can't link the image subject to the asset's audience or topic in one sentence, you're picking the wrong subject.`,
    });
  }
  // imageStyle === "photo" → no override needed, the baseline contract is photo by default.

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

  // ─────────────────────────────────────────────────────────────
  // Preemptive token budgeting: never send Groq a request that exceeds
  // the per-model TPM ceiling. Estimate input tokens, and if over budget,
  // trim context sources in reverse-priority order BEFORE making the call.
  // This eliminates 413s instead of catching them.
  // ─────────────────────────────────────────────────────────────
  const MODEL_TPM: Record<string, number> = {
    "meta-llama/llama-4-scout-17b-16e-instruct": 30000,
    "moonshotai/kimi-k2-instruct": 10000,
    "llama-3.3-70b-versatile": 12000,
    "llama-3.1-8b-instant": 6000,
  };
  // Conservative char-to-token estimate. Real ratio for English is ~3.8;
  // we use 3.0 to leave headroom and stay safely under.
  const estimateTokens = (s: string) => Math.ceil(s.length / 3.0);
  const estimateMessagesTokens = (
    msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ) =>
    msgs.reduce((sum, m) => {
      const content = typeof m.content === "string" ? m.content : "";
      return sum + estimateTokens(content) + 4; // +4 for role overhead
    }, 0);

  // Trim a single message's content in place. Preserves persona/last-user.
  const trimSystemMessage = (
    msg: OpenAI.Chat.Completions.ChatCompletionMessageParam,
    targetChars: number
  ) => {
    if (typeof msg.content !== "string") return;
    if (msg.content.length <= targetChars) return;
    msg.content = msg.content.slice(0, targetChars) + "\n…[trimmed for token budget]";
  };

  // Trim groqMessages down until it fits within budgetTokens.
  // Priority (least → most important, dropped first):
  // 1. Conversation history (oldest first, sliced)
  // 2. Web search context
  // 3. Negative patterns
  // 4. Intel context
  // 5. Examples
  // 6. Brand context
  // 7. Training pairs
  // 8. Site scrape (only if absolutely needed)
  // NEVER trim: persona, date, format hint, last user message
  const fitToBudget = (
    msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    budgetTokens: number
  ) => {
    let usage = estimateMessagesTokens(msgs);
    if (usage <= budgetTokens) return msgs;

    // Identify trimmable system messages by content signature
    const signatures: Array<{ test: (s: string) => boolean; cap: number }> = [
      { test: (s) => s.startsWith("Web search results") || s.includes("Live web research"), cap: 800 },
      { test: (s) => s.includes("AVOID THESE PATTERNS"), cap: 400 },
      { test: (s) => s.startsWith("Recent scraped intel"), cap: 800 },
      { test: (s) => s.includes("Style/voice reference") || s.includes("high-rated past examples") || s.includes("Here are examples of past"), cap: 1200 },
      { test: (s) => s.startsWith("USER'S BRAND DOCUMENTS"), cap: 2000 },
      { test: (s) => s.includes("DMOOP TUNED — KNOWLEDGE BASE"), cap: 2500 },
      { test: (s) => s.includes("LIVE WEBSITE SCRAPE"), cap: 8000 },
    ];

    // Walk signatures, trim corresponding messages
    for (const { test, cap } of signatures) {
      if (usage <= budgetTokens) break;
      const targetMsg = msgs.find((m) => typeof m.content === "string" && test(m.content));
      if (targetMsg) {
        trimSystemMessage(targetMsg, cap);
        usage = estimateMessagesTokens(msgs);
      }
    }

    // Still over? Trim older history messages aggressively
    if (usage > budgetTokens) {
      const userAndAssistantMsgs = msgs.filter((m) => m.role === "user" || m.role === "assistant");
      // Keep the last user message in full; aggressively trim earlier turns
      for (let i = 0; i < userAndAssistantMsgs.length - 1; i++) {
        if (usage <= budgetTokens) break;
        trimSystemMessage(userAndAssistantMsgs[i], 200);
        usage = estimateMessagesTokens(msgs);
      }
    }

    // Last resort: drop the lowest-priority system messages entirely
    if (usage > budgetTokens) {
      for (const { test } of signatures) {
        if (usage <= budgetTokens) break;
        const idx = msgs.findIndex((m) => typeof m.content === "string" && test(m.content));
        if (idx > -1) {
          msgs.splice(idx, 1);
          usage = estimateMessagesTokens(msgs);
        }
      }
    }

    return msgs;
  };

  const effectiveModelId = effectiveModelIdEarly;

  const encoder = new TextEncoder();
  let fullResponse = "";
  const useFineTuned =
    effectiveModelId === "dmoop-tuned" && isFineTunedModelConfigured();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ───────────────────────────────────────────────────────────
        // "Think like a human" phase. Before the main answer model
        // runs, a planner pass (Groq 8B) reads the user's prompt and
        // produces a structured research plan: a distilled intent
        // sentence + 2-4 steps. We stream the plan to the client as
        // research markers (parsed by stream-chat.ts) so the user sees
        // a live "Researching..." trace; web_search steps are then
        // executed in parallel and their findings appended to
        // groqMessages as additional system context before the main
        // answer model gets called below. brand_voice / training_pairs
        // steps are confirmation labels — the actual context for those
        // is already injected via voiceProfileContext + trainingPairsContext.
        // ───────────────────────────────────────────────────────────
        try {
          const recentContext = messages
            .slice(-4)
            .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 300)}`)
            .join("\n");
          const plan = await planResearch(userQuery, recentContext, groqKey);

          controller.enqueue(encoder.encode(encodeIntentMarker(plan.intent)));

          const webSteps = plan.steps.filter(
            (s): s is ResearchStep & { query: string } => s.kind === "web_search" && !!s.query
          );
          const otherSteps = plan.steps.filter((s) => s.kind !== "web_search");

          // Emit "started" markers for ALL web searches up-front so the
          // user sees the full plan stack immediately, then run them in
          // parallel and emit "done" as each settles.
          for (const s of webSteps) {
            controller.enqueue(encoder.encode(encodeStepMarker(s, "started")));
          }
          const webPromises = webSteps.map((s) =>
            researchSearch(s.query).catch(() => null)
          );
          const webResults = await Promise.all(webPromises);

          let combinedResearch = "";
          for (let i = 0; i < webSteps.length; i++) {
            const step = webSteps[i];
            const result = webResults[i];
            const hosts = result
              ? Array.from(
                  new Set(
                    result.results
                      .slice(0, 5)
                      .map((r) => {
                        try { return new URL(r.url).hostname.replace(/^www\./, ""); }
                        catch { return null; }
                      })
                      .filter((h): h is string => !!h)
                  )
                )
              : [];
            const sources = hosts.length > 0
              ? `read ${hosts.join(", ")}`
              : "nothing fresh on this one";
            controller.enqueue(
              encoder.encode(encodeStepMarker({ ...step, result: sources }, "done"))
            );
            if (result) combinedResearch += formatResearchForContext(result) + "\n\n";
          }

          for (const step of otherSteps) {
            controller.enqueue(encoder.encode(encodeStepMarker(step, "started")));
            const result =
              step.kind === "brand_voice"
                ? voiceProfileContext
                  ? "got their voice — on-tone going in"
                  : "no brand voice on file yet — using a general tone"
                : trainingPairsContext
                ? "found a few past wins to lean on"
                : "nothing close in the corpus — fresh angle this one";
            controller.enqueue(
              encoder.encode(encodeStepMarker({ ...step, result }, "done"))
            );
          }

          controller.enqueue(encoder.encode(RESEARCH_DONE_MARKER));

          // Inject the parallel web findings into the message list as
          // additional system context — gets consumed by the main answer
          // model alongside the existing brand / training / live-web context.
          if (combinedResearch) {
            groqMessages.push({
              role: "system",
              content: `RESEARCH FINDINGS (from the planner pass — cite inline as [n] and include in the final ## Sources block):\n${combinedResearch}`,
            });
          }
          // Also nudge the model toward the planner's distilled intent so
          // it doesn't drift off-target on long or vague prompts.
          if (plan.intent) {
            groqMessages.push({
              role: "system",
              content: `USER INTENT (planner distilled): ${plan.intent}`,
            });
          }
        } catch (e) {
          // Planner failed → close the research phase so the client
          // stops waiting and stream the answer normally. UX loss
          // (no visible thinking trace) but the chat still works.
          console.warn("research phase failed:", e instanceof Error ? e.message : String(e));
          controller.enqueue(encoder.encode(RESEARCH_DONE_MARKER));
        }

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
          const tryModels = FALLBACK_CHAIN[primaryModel] ?? [primaryModel];

          // Stripped fallback message: persona + format hint + last user message only.
          // Always fits even the smallest TPM bucket (6K) with room for output.
          const lastUserMsg = [...groqMessages].reverse().find((m) => m.role === "user");
          const slimMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            groqMessages[0], // persona
            ...(requestedFormat ? [{ role: "system" as const, content: FORMAT_INSTRUCTIONS[requestedFormat] }] : []),
            ...(lastUserMsg ? [lastUserMsg] : []),
          ];

          // Output budget — bumped so detailed multi-section answers actually fit.
          // Tuned uses llama-4-scout (30K TPM bucket) so it can afford 2048.
          // Apex/Core/Pulse use llama-3.3-70b / 8B which can produce 4K-token answers cleanly.
          const maxTokensForModel = isTuned ? 2048 : 4096;

          let succeeded = false;
          let lastError: Error | null = null;

          for (const modelName of tryModels) {
            // Try full → slim on each model in the chain
            for (const attempt of ["full", "slim"] as const) {
              const rawMessages = attempt === "slim" ? slimMessages : groqMessages;
              // Preemptively shrink to fit TPM. For full attempts, leave 1500-token
              // safety margin under the model's TPM cap for output + variance.
              const tpm = MODEL_TPM[modelName] ?? 6000;
              const reservedOutput = attempt === "slim" ? Math.min(maxTokensForModel, 1536) : maxTokensForModel;
              const inputBudget = Math.max(800, tpm - reservedOutput - 800);
              // Clone so we don't mutate the caller's array
              const messagesToUse = rawMessages.map((m) => ({ ...m }));
              fitToBudget(messagesToUse, inputBudget);

              try {
                const response = await groq.chat.completions.create({
                  model: modelName,
                  messages: messagesToUse,
                  stream: true,
                  temperature: 0.7,
                  max_tokens: reservedOutput,
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
                const isRateLimit = msg.includes("429") || lower.includes("rate limit");
                const isTooLarge =
                  msg.includes("413") ||
                  lower.includes("too large") ||
                  lower.includes("context_length_exceeded") ||
                  lower.includes("maximum context") ||
                  lower.includes("tokens per minute");

                if (isTooLarge && attempt === "full") {
                  // Try slim on the same model before moving to the next one
                  continue;
                }
                if (isTooLarge || isRateLimit) {
                  // Slim already failed OR pure rate-limit — move to next model in chain
                  break;
                }
                // Some other error (auth, 500, bad request) — surface immediately
                throw lastError;
              }
            }
            if (succeeded) break;
          }

          if (!succeeded && lastError) {
            const friendly = buildQuotaExhaustedMessage(lastError, isTuned);
            const isQuotaError =
              lastError.message.includes("413") ||
              lastError.message.toLowerCase().includes("too large") ||
              lastError.message.includes("429") ||
              lastError.message.toLowerCase().includes("rate limit") ||
              lastError.message.toLowerCase().includes("tokens per minute") ||
              lastError.message.toLowerCase().includes("tokens per day") ||
              lastError.message.toLowerCase().includes("quota");
            if (isQuotaError) {
              controller.enqueue(encoder.encode(friendly));
              succeeded = true; // graceful degrade — show message to user instead of error
            } else {
              throw lastError;
            }
          }
        }

        // ── SAFETY: output guardrail (post-stream sidecar) ──
        // Stream is already flushed for UX, so moderation runs in parallel
        // with interaction-logging. If Llama Guard flags the response we log
        // the incident AND append a visible warning trailer the client renders.
        if (fullResponse.length > 20) {
          moderateText(fullResponse, "assistant").then(async (modOut) => {
            if (!modOut.safe) {
              try {
                controller.enqueue(
                  encoder.encode(
                    `\n\n---\n\n${refusalForUnsafeOutput(modOut.categories)}`
                  )
                );
              } catch {}
              await logSafetyIncident({
                kind: "output_unsafe",
                severity: "high",
                categories: modOut.categories,
                excerpt: fullResponse.slice(0, 500),
                action_taken: "flagged",
                user_id: userId,
                user_email: userEmail,
                model: modelId,
              });
            }
          }).catch((err) => console.error("output moderation failed:", err));
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
        // Even if a quota error escapes the chain loop's friendly handler
        // (e.g. error class with a different shape), catch it here too so
        // the user never sees the raw Groq 413/429 text.
        const errObj = err instanceof Error ? err : new Error(String(err));
        const msg = errObj.message;
        const lower = msg.toLowerCase();
        const isQuotaError =
          msg.includes("413") ||
          msg.includes("429") ||
          lower.includes("too large") ||
          lower.includes("rate limit") ||
          lower.includes("tokens per minute") ||
          lower.includes("tokens per day") ||
          lower.includes("quota");
        if (isQuotaError) {
          controller.enqueue(encoder.encode(buildQuotaExhaustedMessage(errObj, isTuned)));
        } else {
          controller.enqueue(encoder.encode(`\n\n⚠️ ${msg}`));
        }
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
