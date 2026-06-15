import { Message, ResearchTrace, ResearchTraceStep } from "./chat-store";
import { ModelId } from "./models";

interface StreamArgs {
  messages: Message[];
  model: ModelId;
  webSearchMode?: "auto" | "on" | "off";
  /** If set, sent to the API so the system prompt is augmented to produce
   * output that converts cleanly to the requested format (e.g. table-first for xlsx/csv). */
  requestedFormat?: string;
  /** Brand Agent the user wants this turn grounded against. When omitted
   *  the server falls back to the user's default agent via the retrieve_brand_chunks RPC. */
  agentId?: string | null;
  /** Image generation mode for this turn. "on" → include inline AI-generated
   *  images in visual creative responses. "off" → text-only output. */
  imageMode?: "on" | "off";
  /** Visual style for inline-generated images: "photo" | "3d" | "illustration". */
  imageStyle?: "photo" | "3d" | "illustration";
  /** Output language as BCP-47 code ("en", "es", "pt-BR", etc.) or "auto"
   *  to match the user's input language per the LANGUAGE CONTRACT. */
  outputLanguage?: string;
  /** Streamed each time the assistant emits text tokens (the body of the answer,
   *  AFTER the research trace has finished). Receives the accumulated content. */
  onToken: (acc: string) => void;
  /** Streamed each time a research marker arrives — intent, step start, step done.
   *  Caller uses this to live-update the message's researchTrace so the visible
   *  thinking block fills in as the executor works. */
  onResearch?: (trace: ResearchTrace) => void;
}

interface StreamResult {
  text: string;
  interactionId: string | null;
  researchTrace: ResearchTrace | null;
}

const INTERACTION_ID_RE = /<!--\s*interaction_id:([a-f0-9-]+)\s*-->/;
// Research-phase markers — see encode helpers in lib/research-planner.ts.
// Matched non-greedily and anchored against the comment-end so the JSON
// payload can contain arbitrary characters (the encoder escapes any literal
// "-->" inside the payload before emitting).
const RESEARCH_INTENT_RE = /<!--research:intent:([^]*?)-->/;
const RESEARCH_STEP_RE = /<!--research:step:([^]*?)-->/;
const RESEARCH_DONE_RE = /<!--research:done-->/;

interface ParseState {
  rawConsumed: string;          // everything we've successfully parsed/displayed
  rawPending: string;           // bytes that may still contain a partial marker
  researchPhase: boolean;       // true until <!--research:done--> arrives
  trace: ResearchTrace | null;  // accumulated trace
  answerBody: string;           // bytes that arrived AFTER research_done
}

function applyStepEvent(trace: ResearchTrace, ev: ResearchTraceStep): ResearchTrace {
  // A "started" event appends a new step; a "done" event flips the most
  // recent matching step's status and merges in the result. Matching is
  // by (kind, label) — the encoder always emits both for the same step
  // so collisions on identical labels in the same trace are not a concern.
  if (ev.status === "started") {
    const exists = trace.steps.some((s) => s.label === ev.label && s.kind === ev.kind);
    return exists ? trace : { ...trace, steps: [...trace.steps, ev] };
  }
  return {
    ...trace,
    steps: trace.steps.map((s) =>
      s.label === ev.label && s.kind === ev.kind
        ? { ...s, status: "done", result: ev.result ?? s.result }
        : s
    ),
  };
}

function consumeResearchMarkers(state: ParseState, onResearch?: (t: ResearchTrace) => void): void {
  // Pull as many complete research markers as possible out of rawPending.
  while (state.researchPhase) {
    // Try intent first (only one ever fires, at the very start)
    const intentMatch = state.rawPending.match(RESEARCH_INTENT_RE);
    const stepMatch = state.rawPending.match(RESEARCH_STEP_RE);
    const doneMatch = state.rawPending.match(RESEARCH_DONE_RE);

    // Find the earliest marker by index — we want to consume in order.
    type Candidate = { idx: number; full: string; type: "intent" | "step" | "done"; payload?: string };
    const candidates: Candidate[] = [];
    if (intentMatch && intentMatch.index !== undefined) {
      candidates.push({ idx: intentMatch.index, full: intentMatch[0], type: "intent", payload: intentMatch[1] });
    }
    if (stepMatch && stepMatch.index !== undefined) {
      candidates.push({ idx: stepMatch.index, full: stepMatch[0], type: "step", payload: stepMatch[1] });
    }
    if (doneMatch && doneMatch.index !== undefined) {
      candidates.push({ idx: doneMatch.index, full: doneMatch[0], type: "done" });
    }
    if (candidates.length === 0) return;
    candidates.sort((a, b) => a.idx - b.idx);
    const earliest = candidates[0];

    // Strip everything up to and including the marker out of pending.
    state.rawPending = state.rawPending.slice(earliest.idx + earliest.full.length);

    if (earliest.type === "intent") {
      const intent = (earliest.payload ?? "").replace(/—>/g, "-->").trim();
      state.trace = { intent, steps: state.trace?.steps ?? [] };
    } else if (earliest.type === "step" && earliest.payload) {
      try {
        const restored = earliest.payload.replace(/—>/g, "-->");
        const ev = JSON.parse(restored) as ResearchTraceStep;
        state.trace = applyStepEvent(
          state.trace ?? { intent: "", steps: [] },
          ev
        );
      } catch {
        // Malformed step — skip silently rather than break the stream.
      }
    } else if (earliest.type === "done") {
      state.researchPhase = false;
    }

    if (state.trace) onResearch?.(state.trace);
  }
}

export async function streamChat({
  messages,
  model,
  webSearchMode = "auto",
  requestedFormat,
  agentId,
  imageMode = "on",
  imageStyle = "photo",
  outputLanguage = "auto",
  onToken,
  onResearch,
}: StreamArgs): Promise<StreamResult> {
  const payload = {
    model,
    web_search_mode: webSearchMode,
    requested_format: requestedFormat,
    agent_id: agentId ?? null,
    image_mode: imageMode,
    image_style: imageStyle,
    output_language: outputLanguage,
    messages: messages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content })),
  };

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Chat request failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const state: ParseState = {
    rawConsumed: "",
    rawPending: "",
    researchPhase: true,
    trace: null,
    answerBody: "",
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    state.rawPending += decoder.decode(value, { stream: true });

    consumeResearchMarkers(state, onResearch);

    if (!state.researchPhase) {
      // Everything in rawPending after research_done is body text.
      // Flush it to the answer accumulator and emit a token event.
      if (state.rawPending) {
        state.answerBody += state.rawPending;
        state.rawPending = "";
      }
      const displayed = state.answerBody.replace(INTERACTION_ID_RE, "").trimEnd();
      onToken(displayed);
    }
  }

  // Edge case: the server emitted research markers but never research:done
  // (e.g. early error). Fall back to treating all unmatched pending bytes
  // as the answer body so we don't lose content.
  if (state.researchPhase && state.rawPending) {
    state.answerBody = state.rawPending;
    state.rawPending = "";
    const displayed = state.answerBody.replace(INTERACTION_ID_RE, "").trimEnd();
    onToken(displayed);
  }

  const match = state.answerBody.match(INTERACTION_ID_RE);
  const interactionId = match ? match[1] : null;
  const text = state.answerBody.replace(INTERACTION_ID_RE, "").trimEnd();

  return { text, interactionId, researchTrace: state.trace };
}

export async function submitFeedback(
  interactionId: string,
  rating: 1 | -1,
  userEdit?: string
): Promise<void> {
  await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      interaction_id: interactionId,
      rating,
      user_edit: userEdit,
    }),
  });
}
