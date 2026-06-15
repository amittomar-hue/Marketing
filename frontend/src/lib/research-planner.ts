// ─────────────────────────────────────────────────────────────────
// Research planner — first leg of the "think like a human" chat
// flow. Before the main answer-generation model runs, a fast Groq
// 8B-instant pass reads the user's prompt + conversation context
// and produces a small structured plan: the core intent the user
// is really after, plus 2-4 research steps the system should run
// to ground the answer. Each step is one of:
//   • intent          — distills what the user actually wants (always first)
//   • web_search      — runs a targeted Exa/Tavily query for fresh sources
//   • brand_voice     — confirms the agent's brand context is loaded
//   • training_pairs  — confirms the Tuned corpus is being consulted
//
// The plan is streamed to the client as research_step markers BEFORE
// the main answer so users see the reasoning happen — same UX shape
// as Perplexity's Pro mode or Claude's extended thinking. The chat
// route then executes the web_search steps in parallel and feeds
// the synthesised findings into the main answer call.
// ─────────────────────────────────────────────────────────────────

import OpenAI from "openai";

export type ResearchStepKind = "intent" | "web_search" | "brand_voice" | "training_pairs";

export interface ResearchStep {
  /** One of the four kinds. UI styles + the route's executor switch on this. */
  kind: ResearchStepKind;
  /** Human-readable label shown in the visible thinking trace
   *  (e.g. "Pulling recent ABM benchmark reports"). */
  label: string;
  /** For web_search steps: the actual query to send to the search provider.
   *  For other kinds: unused. */
  query?: string;
  /** Populated after execution. For web_search: source URL hostnames.
   *  For intent: the distilled intent string. Unused for brand_voice / training_pairs. */
  result?: string;
}

export interface ResearchPlan {
  /** One-line description of what the user really wants. Drives the UI's
   *  "Considering: …" header and gets injected into the final-answer
   *  system prompt as a north star for the model. */
  intent: string;
  steps: ResearchStep[];
}

const PLANNER_MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You plan how an AI marketing assistant should research a question before answering it. Read the user's prompt and return a JSON plan with two fields:

  intent  — ONE sentence stating what the user actually wants. Specific. If they asked "draft an email", say "Draft a cold-outreach email targeting [audience inferred from context]". Avoid restating the question verbatim.
  steps   — array of 2-4 research steps, in execution order.

Each step is a JSON object:
  { "kind": "web_search" | "brand_voice" | "training_pairs", "label": "Short verb phrase", "query": "search string (web_search only)" }

Rules:
- "label" is what the user SEES in a Researching... trace. Action-oriented, present continuous. Examples:
    "Pulling 3 recent Forrester reports on ABM tier-1 motions"
    "Cross-referencing your brand voice for cold-email tone"
    "Checking the DMOOP training corpus for proven cold-outreach openers"
- "web_search" steps must include a "query" that is SHARPER than the user's prompt — add a year (2026), name a specific framework or vendor, etc. Generic ("ABM") wastes the search budget; specific ("ABM tier-1 account-based outreach playbook 2026 B2B SaaS") wins.
- 2-4 steps total. Always include exactly one brand_voice step ("Cross-referencing your brand voice...") and exactly one training_pairs step ("Checking the DMOOP training corpus..."). The remaining 0-2 slots are web_search steps. The brand_voice and training_pairs steps go LAST because they're internal-context checks; web_search goes first because it's where the real freshness comes from.
- If the user's question is a simple conversational reply (e.g. "shorter", "in US English", "thanks") return zero web_search steps — still include brand_voice and training_pairs.

Return ONLY the JSON. No preamble, no markdown fences.`;

export async function planResearch(
  userQuery: string,
  conversationContext: string,
  apiKey: string
): Promise<ResearchPlan> {
  // Conservative fallback used when the planner errors, returns
  // malformed JSON, or the API key is missing. Keeps the chat flow
  // working — the user still sees a thinking trace, just a generic one.
  const fallback: ResearchPlan = {
    intent: userQuery.length > 140 ? userQuery.slice(0, 137) + "…" : userQuery,
    steps: [
      { kind: "brand_voice", label: "Cross-referencing your brand voice profile" },
      { kind: "training_pairs", label: "Checking the DMOOP training corpus for similar past answers" },
    ],
  };

  if (!apiKey || !userQuery.trim()) return fallback;

  const groq = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  try {
    const res = await groq.chat.completions.create({
      model: PLANNER_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: conversationContext
            ? `Recent conversation:\n${conversationContext}\n\nCurrent user prompt:\n${userQuery}`
            : userQuery,
        },
      ],
    });
    const raw = res.choices[0]?.message?.content?.trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as ResearchPlan;
    if (!parsed.intent || !Array.isArray(parsed.steps)) return fallback;

    // Normalise: ensure brand_voice + training_pairs are present at the
    // end even if the model forgot. Cap web_search count at 2 to keep
    // the latency budget reasonable.
    const webSteps = parsed.steps
      .filter((s) => s.kind === "web_search" && s.query)
      .slice(0, 2);
    const hasBrandVoice = parsed.steps.some((s) => s.kind === "brand_voice");
    const hasPairs = parsed.steps.some((s) => s.kind === "training_pairs");

    const finalSteps: ResearchStep[] = [
      ...webSteps,
      ...(hasBrandVoice
        ? parsed.steps.filter((s) => s.kind === "brand_voice").slice(0, 1)
        : [{ kind: "brand_voice" as const, label: "Cross-referencing your brand voice profile" }]),
      ...(hasPairs
        ? parsed.steps.filter((s) => s.kind === "training_pairs").slice(0, 1)
        : [{ kind: "training_pairs" as const, label: "Checking the DMOOP training corpus for similar past answers" }]),
    ];

    return {
      intent: parsed.intent.slice(0, 240),
      steps: finalSteps,
    };
  } catch (e) {
    console.warn("research planner failed:", e instanceof Error ? e.message : String(e));
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────
// Stream protocol. The chat route writes one JSON object per line
// between sentinel markers so the client can parse research events
// incrementally without breaking the existing plain-text answer stream.
//
// Wire format on stdout, in order:
//   <!--research:intent:Distilled intent string-->
//   <!--research:step:{"kind":"...","label":"...","status":"started"}-->
//   <!--research:step:{"kind":"...","label":"...","status":"done","result":"..."}-->
//   ...
//   <!--research:done-->
//   <answer body streams here as plain markdown text>
//   <!-- interaction_id:abc -->
//
// stream-chat.ts client parses out research markers, accumulates them
// into Message.researchTrace, and only renders bytes AFTER research:done
// as the final answer content.
// ─────────────────────────────────────────────────────────────────

export function encodeIntentMarker(intent: string): string {
  // Strip any -- to avoid breaking the comment marker, and clip length.
  const safe = intent.replace(/-->/g, "—>").slice(0, 400);
  return `<!--research:intent:${safe}-->\n`;
}

export function encodeStepMarker(
  step: ResearchStep,
  status: "started" | "done"
): string {
  const payload = JSON.stringify({
    kind: step.kind,
    label: step.label,
    status,
    ...(status === "done" && step.result ? { result: step.result } : {}),
  });
  // Same dash-escape as above so the JSON payload can never contain --> .
  const safe = payload.replace(/-->/g, "—>");
  return `<!--research:step:${safe}-->\n`;
}

export const RESEARCH_DONE_MARKER = "<!--research:done-->\n";
