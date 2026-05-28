#!/usr/bin/env node
/**
 * Synthetic Marketing LLM training data generator.
 * Uses Groq Llama 3.3 70B as a teacher to create high-quality Q&A pairs
 * for fine-tuning Llama 3.1 8B (student model).
 *
 * Usage:
 *   GROQ_API_KEY=gsk_... node training/scripts/generate_dataset.js [count]
 *
 * Output: training/data/marketing_sft.jsonl (one JSON per line)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GROQ_KEY = process.env.GROQ_API_KEY;
if (!GROQ_KEY) {
  console.error("GROQ_API_KEY required");
  process.exit(1);
}

const COUNT = parseInt(process.argv[2] ?? "200", 10);
const OUT_PATH = path.resolve(__dirname, "../data/marketing_sft.jsonl");

// ─────────────────────────────────────────────
// Topic taxonomy — each intent gets even coverage
// ─────────────────────────────────────────────
const INTENTS = [
  {
    intent: "ad_copy",
    weight: 0.20,
    seeds: [
      "Generate Google Ads search ad copy for a {product} targeting {audience}.",
      "Write 3 Meta (Facebook/Instagram) ad variants for a {product} aimed at {audience}.",
      "Create LinkedIn sponsored content ad copy for a B2B {product}.",
      "Draft TikTok ad creative concepts for a {product} targeting Gen Z.",
      "Write a YouTube pre-roll ad script for a {product} in the {industry} space.",
    ],
  },
  {
    intent: "email",
    weight: 0.15,
    seeds: [
      "Write a product launch email sequence for a {product} (5 emails).",
      "Generate 5 cold outreach email variants to {audience} promoting a {product}.",
      "Draft an abandoned cart email for a {product} ecommerce store.",
      "Write a re-engagement email for lapsed customers of a {product}.",
      "Create a webinar invite email for {audience} on the topic of {product}.",
    ],
  },
  {
    intent: "social",
    weight: 0.12,
    seeds: [
      "Write 5 LinkedIn posts establishing thought leadership in the {industry} space.",
      "Draft a thread of 8 tweets/X posts on the topic of {topic} for {audience}.",
      "Generate Instagram caption + hashtag set for a {product} launch.",
      "Write a TikTok video script (45 seconds) about {topic} for {audience}.",
    ],
  },
  {
    intent: "landing_page",
    weight: 0.10,
    seeds: [
      "Write complete landing page copy for a {product} targeting {audience}.",
      "Draft a pricing page for a {product} (3 tiers, with copy for each).",
      "Generate a 'How it works' section explaining {product} in 3 steps.",
      "Write the hero section (headline, subhead, CTA) for a {product} site.",
    ],
  },
  {
    intent: "blog",
    weight: 0.08,
    seeds: [
      "Outline a 1500-word blog post on {topic} for {audience} (SEO-optimized).",
      "Write the intro + outline for a thought-leadership article on {topic}.",
      "Generate 10 blog post title ideas on {topic} for {industry} readers.",
    ],
  },
  {
    intent: "strategy",
    weight: 0.10,
    seeds: [
      "Build a 90-day go-to-market plan for a {product} launching into {market}.",
      "Suggest a content marketing strategy for a {product} targeting {audience}.",
      "Recommend a paid + organic channel mix for a {product} with a $50k/mo budget.",
      "Design a referral program for a {product} in the {industry} space.",
    ],
  },
  {
    intent: "competitor",
    weight: 0.08,
    seeds: [
      "Analyze how {product} competitors typically position themselves and suggest counter-angles.",
      "Build a competitive teardown framework for a {product} in {market}.",
      "Compare positioning strategies of 3 leaders in the {industry} space.",
    ],
  },
  {
    intent: "brand_voice",
    weight: 0.07,
    seeds: [
      "Score this copy against a 'confident, data-driven, no-fluff' brand voice: {sample}",
      "Rewrite this sentence in a 'playful, relatable, conversational' brand voice: {sample}",
      "Identify the brand voice attributes from this paragraph: {sample}",
    ],
  },
  {
    intent: "trend",
    weight: 0.10,
    seeds: [
      "Identify 3 emerging marketing trends in {industry} for next quarter.",
      "Explain the 'nostalgia marketing' trend and how a {product} brand could leverage it.",
      "What are the top creator-economy trends affecting {industry} marketers?",
    ],
  },
];

const PRODUCTS = [
  "AI-powered marketing platform", "DTC skincare brand", "B2B SaaS for HR teams",
  "fintech app for freelancers", "meal kit subscription", "fitness wearable",
  "online course platform", "EV charging network", "telehealth service",
  "no-code automation tool", "sustainable fashion brand", "pet insurance",
  "language learning app", "Web3 wallet", "cybersecurity SaaS",
  "video conferencing tool", "smart home security system", "podcast hosting platform",
  "developer documentation SaaS", "AI legal assistant",
];

const AUDIENCES = [
  "Series A founders", "marketing directors at mid-market D2C brands",
  "millennial small-business owners", "Gen Z college students", "enterprise CTOs",
  "freelance designers", "working parents", "fitness enthusiasts in their 30s",
  "B2B procurement managers", "early-stage startup CEOs", "remote engineering teams",
  "growth marketers at e-commerce companies", "HR leaders at $50M+ companies",
];

const INDUSTRIES = [
  "fintech", "healthtech", "edtech", "climate tech", "retail",
  "manufacturing", "professional services", "hospitality", "logistics",
];

const TOPICS = [
  "AI-personalized marketing", "first-party data strategy", "TikTok marketing for B2B",
  "creator-led growth", "community-led growth", "product-led growth",
  "vertical SaaS positioning", "content distribution beyond SEO",
  "conversion rate optimization psychology", "outbound sales sequences that convert",
];

const SAMPLES = [
  "We're the world-class, cheapest, best-in-class solution your team will love.",
  "Our innovative platform leverages cutting-edge AI to deliver synergies.",
  "Stop guessing. Start growing. Pipeline that compounds, not campaigns that stall.",
  "Look — we know SaaS pricing is broken. So we fixed it. $99/seat, no upsells.",
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function buildPrompt() {
  const totalWeight = INTENTS.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * totalWeight;
  let intent = INTENTS[0];
  for (const i of INTENTS) {
    r -= i.weight;
    if (r <= 0) { intent = i; break; }
  }
  const seed = pick(intent.seeds);
  const prompt = seed
    .replace(/\{product\}/g, pick(PRODUCTS))
    .replace(/\{audience\}/g, pick(AUDIENCES))
    .replace(/\{industry\}/g, pick(INDUSTRIES))
    .replace(/\{topic\}/g, pick(TOPICS))
    .replace(/\{market\}/g, pick(INDUSTRIES))
    .replace(/\{sample\}/g, pick(SAMPLES));
  return { intent: intent.intent, prompt };
}

const SYSTEM_TEACHER = `You are a senior marketing copywriter producing reference-quality training data for a Marketing LLM.

Generate the IDEAL response a marketing assistant should produce for the user's query.

Requirements:
- Specific, not generic — name real channels, formats, metrics
- Use clean markdown: bold section headers, bullet lists
- For ad copy: include Headline, Body, CTA, predicted CTR for each variant
- For emails: include Subject, Preview text, Body, CTA
- For strategy: include phased timeline, channel mix with % allocation, success metrics
- For brand voice scoring: give a 0-100 score, list flagged terms, explain why
- 200-500 words typical, longer only when warranted
- Direct, no fluff, no "I'd be happy to help"

Return ONLY the response. No preamble. No "Here is..." opener.`;

async function callGroq(intent, prompt, retry = 0) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // 8B-instant has 500K TPD (5x larger free quota than 70B's 100K TPD).
        // Trade-off: lower-quality teacher, but acceptable for warm-up dataset.
        // After fine-tuning works end-to-end, re-generate with 70B for higher quality.
        model: process.env.TEACHER_MODEL ?? "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: SYSTEM_TEACHER },
          { role: "user", content: prompt },
        ],
        temperature: 0.75,
        max_tokens: 1000,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429 && retry < 3) {
        const delay = Math.min(60000, 2000 * Math.pow(2, retry));
        console.log(`  → rate limited, sleeping ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        return callGroq(intent, prompt, retry + 1);
      }
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    if (retry < 2) {
      await new Promise(r => setTimeout(r, 2000));
      return callGroq(intent, prompt, retry + 1);
    }
    throw err;
  }
}

async function main() {
  console.log(`Generating ${COUNT} examples → ${OUT_PATH}`);
  const out = fs.createWriteStream(OUT_PATH, { flags: "w" });

  let ok = 0, fail = 0;
  const intentCounts = {};

  for (let i = 0; i < COUNT; i++) {
    const { intent, prompt } = buildPrompt();
    try {
      const response = await callGroq(intent, prompt);
      if (!response || response.length < 100) {
        fail++;
        continue;
      }
      out.write(JSON.stringify({
        intent,
        instruction: prompt,
        output: response.trim(),
      }) + "\n");
      ok++;
      intentCounts[intent] = (intentCounts[intent] ?? 0) + 1;
      if (ok % 10 === 0) console.log(`  ✓ ${ok}/${COUNT} (intents: ${JSON.stringify(intentCounts)})`);
    } catch (err) {
      fail++;
      console.log(`  ✗ ${err.message}`);
    }
  }

  out.end();
  console.log(`\nDone. ${ok} written, ${fail} failed.`);
  console.log(`Intent distribution:`, intentCounts);
}

main().catch(err => { console.error(err); process.exit(1); });
