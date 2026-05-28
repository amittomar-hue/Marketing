#!/usr/bin/env node
/**
 * Merge high-rated Supabase feedback into the training dataset.
 *
 * Pulls every interaction with avg rating > 0 and appends as new training examples.
 * Run before each training cycle to incorporate accumulated user feedback.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/merge_supabase_feedback.js
 *
 * Output: appends to training/data/marketing_sft.jsonl (deduped by query)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "../data/marketing_sft.jsonl");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

// Use Supabase REST API directly to avoid pulling in @supabase/supabase-js
async function fetchHighRated() {
  const url = `${SUPABASE_URL}/rest/v1/learning_examples?select=intent,query_summary,exemplar_response,score&score=gte.1.0&order=score.desc`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase fetch failed: HTTP ${res.status} — ${await res.text()}`);
  }
  return res.json();
}

function loadExisting() {
  if (!fs.existsSync(DATA_PATH)) return new Set();
  const lines = fs.readFileSync(DATA_PATH, "utf-8").split("\n").filter(Boolean);
  return new Set(lines.map((l) => {
    try { return JSON.parse(l).instruction; } catch { return null; }
  }).filter(Boolean));
}

async function main() {
  console.log(`Fetching high-rated examples from ${SUPABASE_URL}...`);
  const rows = await fetchHighRated();
  console.log(`  Found ${rows.length} candidates with score ≥ 1.0`);

  const existing = loadExisting();
  console.log(`  Existing training examples: ${existing.size}`);

  const out = fs.createWriteStream(DATA_PATH, { flags: "a" });
  let added = 0, skipped = 0;

  for (const row of rows) {
    if (existing.has(row.query_summary)) {
      skipped++;
      continue;
    }
    out.write(JSON.stringify({
      intent: row.intent,
      instruction: row.query_summary,
      output: row.exemplar_response,
      source: "supabase_feedback",
      score: parseFloat(row.score),
    }) + "\n");
    added++;
  }

  out.end();
  console.log(`Done. Added ${added} new examples, skipped ${skipped} duplicates.`);
  console.log(`Total dataset size: ${existing.size + added} examples`);
}

main().catch((err) => { console.error(err); process.exit(1); });
