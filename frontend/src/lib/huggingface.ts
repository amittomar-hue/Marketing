/**
 * Hugging Face Inference API client — used to route requests to a fine-tuned
 * Marketing LLM (Llama 3.1 8B + LoRA adapter) trained on Kaggle.
 *
 * Set HUGGINGFACE_API_TOKEN + HUGGINGFACE_MODEL in Vercel env.
 * Falls back gracefully — caller can check returned `null` and use Groq.
 */

interface HFGenerateArgs {
  prompt: string;          // Full chat-templated text
  maxTokens?: number;
  temperature?: number;
}

export async function* hfStreamGenerate({
  prompt,
  maxTokens = 800,
  temperature = 0.7,
}: HFGenerateArgs): AsyncGenerator<string, void, unknown> {
  const token = process.env.HUGGINGFACE_API_TOKEN;
  const model = process.env.HUGGINGFACE_MODEL;
  if (!token || !model) return;

  const url = `https://api-inference.huggingface.co/models/${model}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens,
        temperature,
        return_full_text: false,
        stream: true,
      },
      options: {
        wait_for_model: true,    // Cold start handling
        use_cache: false,
      },
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`HF Inference failed: ${res.status} — ${await res.text().catch(() => "")}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE-style "data: {...}\n\n" framing
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]" || !payload) continue;
      try {
        const json = JSON.parse(payload);
        const token = json.token?.text ?? json.generated_text ?? "";
        if (token) yield token;
      } catch {
        // Non-JSON keepalive line; skip
      }
    }
  }
}

export function isFineTunedModelConfigured(): boolean {
  return !!(process.env.HUGGINGFACE_API_TOKEN && process.env.HUGGINGFACE_MODEL);
}
