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
const CLOUDFLARE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

// Tiny 1024-byte transparent PNG used as a graceful fallback when the
// HF endpoint is cold-starting, rate-limited, or otherwise unhappy.
// Keeps the chat message from rendering a broken image icon during
// the first few seconds while the user waits.
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

// ─────────────────────────────────────────────────────────────────
// Provider tier 3: Cloudflare Workers AI. Used as fallback when both
// HF Flux + HF SDXL fail (rate-limit, paid-tier transition, model
// unavailability). CF Workers AI has a generous free tier (10K
// requests/day on the Free plan, separate from HF quota), the same
// FLUX.1-schnell weights so visual style stays consistent across
// providers, and lower cold-start latency (~3-5s) than HF's free
// tier when its models are cold (~20-30s).
//
// Returns base64-encoded JPEG inside a JSON wrapper rather than raw
// bytes like HF, so this function decodes the base64 before handing
// the bytes back to the caller. Both error response branches return
// {ok: false} with the parsed CF error message so the caller's logs
// match HF's failure shape.
//
// Skipped silently if either env var (CLOUDFLARE_ACCOUNT_ID,
// CLOUDFLARE_API_TOKEN) is missing — keeps the route running on the
// HF-only configuration when the user hasn't set up CF yet.
// ─────────────────────────────────────────────────────────────────
async function callCloudflare(
  prompt: string,
  width: number,
  height: number,
  seed: number
): Promise<{ ok: boolean; status: number; bytes?: ArrayBuffer; error?: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    return { ok: false, status: 503, error: "Cloudflare env not configured" };
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CLOUDFLARE_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        num_steps: 4,
        seed,
        width,
        height,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text.slice(0, 300) };
  }

  // CF Workers AI returns JSON: { result: { image: "<base64>" }, success: true, errors: [...] }
  // The image bytes are base64-encoded JPEG, NOT raw binary like HF.
  const json = await res.json().catch(() => null);
  const b64 = json?.result?.image;
  if (typeof b64 !== "string" || !b64) {
    return {
      ok: false,
      status: 502,
      error: json?.errors?.[0]?.message ?? "Cloudflare returned no image field",
    };
  }
  const bytes = Buffer.from(b64, "base64");
  return {
    ok: true,
    status: 200,
    bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

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

  // Three-tier fallback chain:
  //   Tier 1: HF FLUX.1-schnell  — fast + free, identical weights to Tier 3
  //   Tier 2: HF SDXL            — different model, kicks in if Flux is unavailable
  //                                or HF's flux endpoint is having a bad day
  //   Tier 3: Cloudflare Workers AI FLUX.1-schnell — only fires if CF env is
  //                                configured. Separate quota from HF so when
  //                                the HF free credits exhaust mid-day, CF
  //                                takes over without the chat noticing.
  // Each tier records which provider served the image in the X-Imagegen-Source
  // header so future debugging can correlate browser-side image renders with
  // the upstream that produced them.
  let result = await callHF(DEFAULT_MODEL, prompt, width, height, seed, token);
  let source: "hf-flux" | "hf-sdxl" | "cloudflare" | "fallback-png" = "hf-flux";

  if (!result.ok) {
    console.warn(`imagegen: ${DEFAULT_MODEL} failed (${result.status}): ${result.error}`);
    result = await callHF(FALLBACK_MODEL, prompt, width, height, seed, token);
    source = "hf-sdxl";
  }

  if (!result.ok) {
    console.warn(`imagegen: ${FALLBACK_MODEL} failed (${result.status}): ${result.error}`);
    const cfResult = await callCloudflare(prompt, width, height, seed);
    if (cfResult.ok) {
      result = cfResult;
      source = "cloudflare";
    } else if (cfResult.status !== 503) {
      // Don't overwrite the last HF error with "CF env not configured" noise —
      // that's the expected state when the user hasn't added CF keys yet.
      console.warn(`imagegen: Cloudflare failed (${cfResult.status}): ${cfResult.error}`);
    }
  }

  if (!result.ok || !result.bytes) {
    // Final fallback — serve the transparent placeholder so the markdown
    // image still resolves to *something* rather than a broken icon.
    return new Response(FALLBACK_PNG, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Imagegen-Error": `All providers failed; last status ${result.status}`,
        "X-Imagegen-Source": "fallback-png",
      },
    });
  }

  // Aggressive browser cache — same prompt+seed produces same image, so
  // re-renders of the same chat message can hit the cache instead of
  // re-hitting the upstream. immutable + 30 days covers the long tail
  // of users re-opening conversations.
  return new Response(result.bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=2592000, immutable",
      "X-Imagegen-Source": source,
    },
  });
}
