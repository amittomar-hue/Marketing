import OpenAI from "openai";
import { NextRequest } from "next/server";
import { tavilySearch, formatTavilyForContext } from "@/lib/tavily";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL_MAP: Record<string, string> = {
  "marketing-opus-4": "llama-3.3-70b-versatile",
  "marketing-sonnet-4": "llama-3.3-70b-versatile",
  "marketing-haiku-4": "llama-3.1-8b-instant",
};

const SYSTEM_PROMPT = `You are Marketing LLM, an enterprise-grade marketing assistant powered by real-time web research.

You help marketing teams with:
- Generating ad copy for Google Ads, Meta, LinkedIn, TikTok, and other channels
- Detecting and analyzing real-time marketing trends
- Researching competitors with current data, not training-data guesses
- Writing email sequences, landing page copy, and full campaign strategies
- Scoring content against brand voice guidelines
- Building go-to-market strategies and positioning

You will receive a "Web search results" block before each user question. Use those results as your primary source of truth. When the user asks about a specific company, competitor, market, or current trend, cite the URLs from the search results inline using [1], [2], etc. — and include a Sources section at the end of your reply listing each URL.

Be direct, specific, and data-driven. Format responses in clean markdown with bold section headers.`;

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

function looksLikeWebQuery(text: string): boolean {
  if (text.length < 5) return false;
  if (/\b(competitor|competit|alternative|vs\.|trend|trending|latest|current|recent|news|today|this week|2024|2025|2026)\b/i.test(text)) return true;
  if (/\b(www\.|https?:\/\/|\.com|\.io|\.ai|\.org|\.net)\b/i.test(text)) return true;
  if (/\b(who|what|when|where|how much|how many|price|cost|market share|revenue|funding)\b/i.test(text)) return true;
  return true; // Default to searching — marketing queries usually benefit from web data
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages: ClientMessage[] = body.messages ?? [];
  const modelId: string = body.model ?? "marketing-sonnet-4";

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return new Response(
      JSON.stringify({
        error:
          "GROQ_API_KEY is not configured in Vercel environment variables.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userQuery = lastUser?.content ?? "";

  let webContext = "";
  if (process.env.TAVILY_API_KEY && looksLikeWebQuery(userQuery)) {
    try {
      const tavily = await tavilySearch(userQuery);
      webContext = formatTavilyForContext(tavily);
    } catch (err) {
      webContext = `(Web search unavailable: ${
        err instanceof Error ? err.message : "unknown error"
      })`;
    }
  }

  const groq = new OpenAI({
    apiKey: groqKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const groqMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (webContext) {
    groqMessages.push({
      role: "system",
      content: webContext,
    });
  }

  messages.forEach((m) => {
    groqMessages.push({ role: m.role, content: m.content });
  });

  const encoder = new TextEncoder();
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
          if (token) controller.enqueue(encoder.encode(token));
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
