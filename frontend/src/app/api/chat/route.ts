import OpenAI from "openai";
import { NextRequest } from "next/server";
import { tavilySearch, formatTavilyForContext } from "@/lib/tavily";
import { classifyIntent } from "@/lib/supabase";
import {
  logInteraction,
  retrieveExamples,
  formatExamplesAsContext,
} from "@/lib/learning";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL_MAP: Record<string, string> = {
  "marketing-opus-4": "llama-3.3-70b-versatile",
  "marketing-sonnet-4": "llama-3.3-70b-versatile",
  "marketing-haiku-4": "llama-3.1-8b-instant",
};

const SYSTEM_PROMPT = `You are Marketing LLM, an enterprise-grade marketing assistant powered by real-time web research and a self-learning feedback loop.

You help marketing teams with:
- Generating ad copy for Google Ads, Meta, LinkedIn, TikTok, and other channels
- Detecting and analyzing real-time marketing trends
- Researching competitors with current data, not training-data guesses
- Writing email sequences, landing page copy, and full campaign strategies
- Scoring content against brand voice guidelines
- Building go-to-market strategies and positioning

Behavior rules:
- When provided "Web search results" context, treat those URLs as the source of truth and cite them inline as [1], [2], etc. End the message with a Sources section listing each URL.
- When provided "high-rated past examples" context, learn their structure, depth, and tone — do not copy verbatim. Match or exceed their quality.
- Be direct, specific, and data-driven.
- Format responses in clean markdown with bold section headers.`;

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
  const modelId: string = body.model ?? "marketing-sonnet-4";
  const sessionId: string | undefined = body.session_id;

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

  // ── Web search context ─────────────────────────────────────
  let webContext = "";
  let webUsed = false;
  if (process.env.TAVILY_API_KEY && looksLikeWebQuery(userQuery)) {
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

  // ── Self-learning: retrieve top-rated past examples for this intent ─
  let examplesContext = "";
  try {
    const examples = await retrieveExamples(intent, userQuery, 3);
    examplesContext = formatExamplesAsContext(examples);
  } catch (err) {
    console.error("retrieve examples failed:", err);
  }

  const groq = new OpenAI({
    apiKey: groqKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const groqMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (examplesContext) {
    groqMessages.push({
      role: "system",
      content: `High-rated past examples for intent="${intent}":\n\n${examplesContext}`,
    });
  }

  if (webContext) {
    groqMessages.push({ role: "system", content: webContext });
  }

  messages.forEach((m) => {
    groqMessages.push({ role: m.role, content: m.content });
  });

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await groq.chat.completions.create({
          model: MODEL_MAP[modelId] ?? MODEL_MAP["marketing-sonnet-4"],
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

        // Log this interaction for learning (best-effort, non-blocking failure)
        const interactionId = await logInteraction({
          user_query: userQuery,
          intent,
          response: fullResponse,
          model: modelId,
          web_search_used: webUsed,
          session_id: sessionId,
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
