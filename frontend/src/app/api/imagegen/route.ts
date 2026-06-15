// ─────────────────────────────────────────────────────────────────
// /api/imagegen?prompt=...&width=...&height=...&seed=...
//
// Proxy for inline image generation in chat answers. The system
// prompt's VISUAL CREATIVE CONTRACT tells the model to emit
// ![alt](/api/imagegen?prompt=…) markdown image tags inline. This
// route receives the GET, generates the image via HuggingFace's
// Inference API (FLUX.1-schnell — free tier, decent quality, fast),
// and streams the image bytes back to the browser.
//
// Why not the chat-route stack: image gen wants its own runtime
// budget (Vercel function maxDuration), independent retries, and
// browser-native caching via Cache-Control headers. Decoupling
// keeps the chat stream lean and lets generated images render as
// fast as the chat reply itself once the cache warms.
//
// Previously the chat prompt emitted Pollinations URLs directly to
// the browser; Pollinations switched to a paywalled tier (HTTP 402)
// in mid-2026 so the bare URLs started failing. HF Inference still
// has a working free tier, the token is already in Vercel env, and
// the model selection is one line away from being swappable to
// Together / Replicate / Cloudflare AI / Fal if HF rate-limits us.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = "black-forest-labs/FLUX.1-schnell";
const FALLBACK_MODEL = "stabilityai/stable-diffusion-xl-base-1.0";

// Tiny 1024-byte transparent PNG used as a graceful fallback when the
// HF endpoint is cold-starting, rate-limited, or otherwise unhappy.
// Keeps the chat message from rendering a broken image icon during
// the first few seconds while the user waits.
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

async function callHF(
  model: string,
  prompt: string,
  width: number,
  height: number,
  seed: number,
  token: string
): Promise<{ ok: boolean; status: number; bytes?: ArrayBuffer; error?: string }> {
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // x-wait-for-model lets HF warm a cold model before timing out
      // — better than fail-fast for users on a first-of-day request.
      "x-wait-for-model": "true",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        width,
        height,
        // Flux Schnell ignores num_inference_steps below 4; SDXL prefers 20-30.
        num_inference_steps: model.includes("schnell") ? 4 : 25,
        seed,
        guidance_scale: model.includes("schnell") ? 0.0 : 7.5,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text.slice(0, 300) };
  }
  return { ok: true, status: res.status, bytes: await res.arrayBuffer() };
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const prompt = (url.searchParams.get("prompt") ?? "").slice(0, 1500);
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  // Clamp dimensions to FLUX's supported set (must be multiple of 16).
  const reqW = parseInt(url.searchParams.get("width") ?? "1024", 10);
  const reqH = parseInt(url.searchParams.get("height") ?? "1024", 10);
  const width = Math.min(1536, Math.max(256, Math.round(reqW / 16) * 16));
  const height = Math.min(1536, Math.max(256, Math.round(reqH / 16) * 16));
  const seed = parseInt(url.searchParams.get("seed") ?? "0", 10) || Math.floor(Math.random() * 9999);

  const token = process.env.HUGGINGFACE_API_TOKEN;
  if (!token) {
    return new Response(FALLBACK_PNG, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Imagegen-Error": "HUGGINGFACE_API_TOKEN missing",
      },
    });
  }

  // Try Flux Schnell first (fast + free); if it 4xx/5xx, fall back to SDXL.
  // Both share the HF free tier so we only spend extra latency, not extra cost.
  let result = await callHF(DEFAULT_MODEL, prompt, width, height, seed, token);
  if (!result.ok) {
    console.warn(`imagegen: ${DEFAULT_MODEL} failed (${result.status}): ${result.error}`);
    result = await callHF(FALLBACK_MODEL, prompt, width, height, seed, token);
  }

  if (!result.ok || !result.bytes) {
    // Final fallback — serve the transparent placeholder so the markdown
    // image still resolves to *something* rather than a broken icon.
    return new Response(FALLBACK_PNG, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Imagegen-Error": `Both models failed; last status ${result.status}`,
      },
    });
  }

  // Aggressive browser cache — same prompt+seed produces same image, so
  // re-renders of the same chat message can hit the cache instead of
  // re-hitting HF. immutable + 30 days covers the long tail of users
  // re-opening conversations.
  return new Response(result.bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
