import { Message } from "./chat-store";
import { ModelId } from "./models";

interface StreamArgs {
  messages: Message[];
  model: ModelId;
  webSearchMode?: "auto" | "on" | "off";
  /** If set, sent to the API so the system prompt is augmented to produce
   * output that converts cleanly to the requested format (e.g. table-first for xlsx/csv). */
  requestedFormat?: string;
  onToken: (acc: string) => void;
}

interface StreamResult {
  text: string;
  interactionId: string | null;
}

const INTERACTION_ID_RE = /<!--\s*interaction_id:([a-f0-9-]+)\s*-->/;

export async function streamChat({
  messages,
  model,
  webSearchMode = "auto",
  requestedFormat,
  onToken,
}: StreamArgs): Promise<StreamResult> {
  const payload = {
    model,
    web_search_mode: webSearchMode,
    requested_format: requestedFormat,
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
  let raw = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
    const displayed = raw.replace(INTERACTION_ID_RE, "").trimEnd();
    onToken(displayed);
  }

  const match = raw.match(INTERACTION_ID_RE);
  const interactionId = match ? match[1] : null;
  const text = raw.replace(INTERACTION_ID_RE, "").trimEnd();

  return { text, interactionId };
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
