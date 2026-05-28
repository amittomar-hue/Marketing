import { Message } from "./chat-store";
import { ModelId } from "./models";

interface StreamArgs {
  messages: Message[];
  model: ModelId;
  onToken: (acc: string) => void;
}

export async function streamChat({ messages, model, onToken }: StreamArgs): Promise<string> {
  const payload = {
    model,
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
  let acc = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
    onToken(acc);
  }
  return acc;
}
