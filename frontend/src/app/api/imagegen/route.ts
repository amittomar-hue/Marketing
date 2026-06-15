// ─────────────────────────────────────────────────────────────────
// /api/imagegen?prompt=...&width=...&height=...&seed=...
//
// Proxy for inline image generation in chat answers. The chat system
// prompt's VISUAL CREATIVE CONTRACT tells the model to emit
// ![alt](/api/imagegen?prompt=…) markdown image tags inline. This
// route receives the GET, generates the image via Cloudflare Workers
// AI (FLUX.1-schnell on CF's free tier: 10K req/day), and streams
// the image bytes back to the browser.
//
// History: started as a Pollinations URL embedded in the chat prompt
// itself, but Pollinations switched to a paywalled tier in mid-2026
// so we moved to a server-side proxy. Briefly cascaded HF → CF, but
// HF's free Inference tier added cold-start latency (~25s on first
// request) and made the failure mode harder to reason about. Now
// CF-only — single provider, predictable latency, generous free
// quota, and the same model weights as what HF was serving so visual
// style doesn't shift between deploys.
//
// Required Vercel env vars (set via the dashboard — CLI was silently
// writing empty strings, see the earlier session diagnostics):
//   CLOUDFLARE_ACCOUNT_ID  — 32-char hex string from dash.cloudflare.com sidebar
//   CLOUDFLARE_API_TOKEN   — token with Workers AI permission, get at
//                            https://dash.cloudflare.com/profile/api-tokens
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const CLOUDFLARE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

// Tiny 1024-byte transparent PNG used as a graceful fallback when CF
// is rate-limited, the env vars aren't set yet, or the prompt trips
// CF's content filter. Keeps the chat message from rendering a broken
// image icon for the few seconds while the user waits.
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

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
        num_steps: 4, // Flux Schnell is tuned for 4 steps
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

  // CF Workers AI returns JSON: { result: { image: "<base64-encoded-jpeg>" }, success: true, errors: [...] }
  const json = await res.json().catch(() => null);
  const b64 = json?.result?.image;
  if (typeof b64 !== "string" || !b64) {
    return {
      ok: false,
      status: 502,
      error: json?.errors?.[0]?.message ?? "Cloudflare returned no image field",
    };
  }
  const buf = Buffer.from(b64, "base64");
  return { ok: true, status: 200, bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const prompt = (url.searchParams.get("prompt") ?? "").slice(0, 1500);
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  // Clamp dimensions to FLUX's supported set (multiple of 16, range 256-1536).
  const reqW = parseInt(url.searchParams.get("width") ?? "1024", 10);
  const reqH = parseInt(url.searchParams.get("height") ?? "1024", 10);
  const width = Math.min(1536, Math.max(256, Math.round(reqW / 16) * 16));
  const height = Math.min(1536, Math.max(256, Math.round(reqH / 16) * 16));
  const seed = parseInt(url.searchParams.get("seed") ?? "0", 10) || Math.floor(Math.random() * 9999);

  let result;
  try {
    result = await callCloudflare(prompt, width, height, seed);
  } catch (e) {
    console.error("imagegen: Cloudflare threw:", e instanceof Error ? e.message : String(e));
    result = { ok: false as const, status: 500, error: e instanceof Error ? e.message : String(e) };
  }

  if (!result.ok || !result.bytes) {
    if (result.status !== 503) {
      console.warn(`imagegen: Cloudflare failed (${result.status}): ${result.error}`);
    }
    // Graceful degradation — serve the transparent placeholder so the
    // markdown image still resolves to *something* rather than a
    // broken icon. Headers expose the failure reason for diagnostics.
    return new Response(FALLBACK_PNG, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Imagegen-Source": "fallback-png",
        "X-Imagegen-Error": `Cloudflare ${result.status}: ${result.error?.slice(0, 100) ?? "unknown"}`,
      },
    });
  }

  // Aggressive browser cache — same prompt+seed produces the same
  // image, so re-renders of the same chat message hit the cache
  // instead of re-hitting Cloudflare. Immutable + 30 days covers the
  // long tail of users re-opening conversations.
  return new Response(result.bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=2592000, immutable",
      "X-Imagegen-Source": "cloudflare",
    },
  });
}
