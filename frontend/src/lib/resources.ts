// ─────────────────────────────────────────────────────────────────
// DMOOP Resources — blogs, case studies, whitepapers, guides.
// All content is hand-written by the DMOOP team and grounded in
// what the actual product does. Surface on /resources and via the
// homepage Resources section. Each entry renders at /resources/[slug].
// ─────────────────────────────────────────────────────────────────

export type ResourceCategory = "Blog" | "Case Study" | "Whitepaper" | "Guide";

export interface Resource {
  slug: string;
  title: string;
  category: ResourceCategory;
  summary: string;            // 140-220 chars — used on cards
  readMinutes: number;
  publishedAt: string;        // ISO date
  author: string;
  /** Full article body in markdown. Renders through DMOOP's Markdown component. */
  content: string;
}

export const RESOURCES: Resource[] = [
  {
    slug: "ai-overviews-citation-playbook",
    title: "The complete playbook for getting cited by Google AI Overviews",
    category: "Guide",
    summary:
      "AI Overviews now answer ~47% of B2B queries without a click. Here's the exact six-move playbook to be the source the model quotes — schema, structure, signal density.",
    readMinutes: 9,
    publishedAt: "2026-05-28",
    author: "DMOOP Research",
    content: `## TL;DR

Google AI Overviews intercepts roughly half of all B2B search queries before a user clicks anything. If your content isn't structured to be cited, your traffic is being silently re-routed to whichever competitor *is*. This playbook walks through six concrete moves that flip the odds.

## Why this matters now

AI Overviews — and its parallel surfaces on Bing Copilot, Perplexity, Claude search, and ChatGPT Browse — extract answers from web content and present them in-place. The blue links still exist, but they're below the fold of a synthesized answer paragraph. The synthesized answer cites 2-6 sources. Being one of those sources is the new SEO ranking.

The structural moves that win citations are different from classical SEO. Ranking #1 organically doesn't guarantee being cited. Being cited doesn't require ranking #1.

## Move 1 — Lead with the answer, not the setup

Models extract the FIRST clean answer they can parse. If your article opens with three paragraphs of "the marketing landscape is constantly evolving," the model will scroll past your content and cite someone who got to the point. Open with a direct answer in the first 60 words. Use it as a TL;DR or a bolded one-liner.

## Move 2 — Structure for span extraction, not for reading

Models extract *spans* — discrete passages they can quote without ambiguity. Spans look like:

- A bullet list with parallel structure
- A table with a header row
- A numbered step list
- A definition: "X is …" sentence

Long flowing prose with three ideas per sentence is hard to extract. Short declarative sentences with one claim each are easy. Re-read your draft and ask: "Could a machine pull each sentence out and have it stand alone?"

## Move 3 — Cite primary data, with the year

Models prefer to cite content that itself cites primary sources. If you write "research shows email open rates are around 22%," the model is taking a risk citing you. If you write "according to HubSpot's 2026 State of Marketing report, B2B SaaS email open rates averaged 21.7%," the model treats your sentence as a safer quote because the provenance is explicit. The model is also implicitly delegating accountability — if HubSpot's number is wrong, that's HubSpot's problem, not the model's.

## Move 4 — Add JSON-LD schema for the article

Models trust pages with structured data more than pages without. Add at minimum:

- \`Article\` schema with \`headline\`, \`datePublished\`, \`author\`
- \`FAQPage\` schema if your content has Q&A sections
- \`BreadcrumbList\` to anchor the page in your site hierarchy

Use \`@id\` cross-references between schemas so search engines treat your domain as a knowledge graph, not a pile of disconnected pages.

## Move 5 — Get cited by other cited pages

This is the modern equivalent of link-building. Models build internal authority scores based on *who cites whom* across the web. A link from a page that AI Overviews already cites is worth far more than a link from a high-DR page that isn't cited.

To find pages worth pitching: run your target keyword through AI Overviews yourself, click the citation chips, note the source pages. Those are the pages that already passed the model's bar.

## Move 6 — Update on a schedule, and date the update

Models discount old content harder than human ranking algorithms do. A 2023 article is treated as stale almost regardless of accuracy. Add an "Updated: [date]" line near the title. Re-publish with the same URL, refreshed numbers, and changes called out.

## Measurement

There's no public "AI Overviews citation rank" tool yet. The proxies that work:

- Search Console: filter for queries with "*" wildcards and check impressions vs clicks ratio. A widening gap = your page is being shown in the panel but the click goes to the synthesized answer.
- Manual sampling: query your top 20 keywords monthly. Note which pages get cited. Track changes.
- Brand mention scrapers: tools like Brand24 and Mention now surface AI Overviews citations specifically.

## What's coming next

Models are starting to weight *evidence trails* — long-form content with verifiable claims linked to primary sources will out-cite short opinion pieces. The marketers who win the next 18 months will be the ones who treat their content the way Wikipedia treats its articles: every claim sourced, every source verifiable, every update transparent.`,
  },

  {
    slug: "training-corpus-evol-instruct",
    title: "How we 4×'d our training corpus in 7 days without writing a single article",
    category: "Case Study",
    summary:
      "From 229 to 854 training pairs in a week using WizardLM-style evolution. The architectural decision, the bug that nearly killed it, and what we learned about LLM data augmentation.",
    readMinutes: 7,
    publishedAt: "2026-06-01",
    author: "DMOOP Engineering",
    content: `## The starting line

Seven days ago the DMOOP training corpus had **229 pairs** across 11 marketing intents and 7 asset types. Today it has **854** across 12 intents and 9 asset types. We added zero new scraping sources, didn't write a single article ourselves, and stayed inside the same Groq free-tier quota.

The lever was a single architectural choice we'd been postponing: WizardLM-style evol-instruct on the existing pipeline.

## The before state

The pipeline ran like this. Tavily scraped marketing articles four times a day. Each article ran through Groq's 8B-instant model with an asset-type-aware prompt (case studies → Situation/Approach/Result, playbooks → numbered steps, etc.) that produced 3 Q&A training pairs per article. Pairs were inserted with quality=1.0 and surfaced to the Tuned model via trigram-similarity retrieval.

The corpus was growing, but linearly. At 229 pairs with a ~20-article-per-cron yield, hitting 1,000 pairs would take ~10 weeks. We needed exponential.

## The evol-instruct decision

The WizardLM evolution method takes a single training pair and rewrites it through three "lenses" — making it more specific, more tactical, or more strategic. The same source article that produces *"How do I build an ABM list?"* becomes *"How do I build an ABM list for a B2B SaaS targeting Series A-B founders?"* (specific), *"Walk me through the step-by-step in HubSpot + 6sense"* (tactical), and *"Given a $2M ARR target, how should I prioritize tier-1 vs tier-2 accounts?"* (strategic).

The math: 3 originals × (1 + 3 variants) = 12 pairs per article. Same Tavily quota, 4× the corpus output. Each variant lives in the same training_pairs table with \`is_evolved = true\` and a \`parent_pair_id\` FK back to the original, so we can audit augmentation quality and slice retrieval to originals-only if needed.

## What broke

Day 2: tactical evolution silently went to **zero pairs/day** while specific and strategic kept landing. The corpus was growing, but the tactical lens — the one we cared most about — was dead.

The cause turned out to be a JSON-parsing edge case. Our parser used \`/\\{[\\s\\S]*\\}/\` to extract the JSON object from the model's response. Strategic and specific produced single-paragraph prose with no internal newlines. Tactical, by design, produced numbered execution steps with raw newlines inside the JSON string values — which \`JSON.parse\` rejects with a syntax error. Combined with our 1,400-token output cap occasionally truncating mid-JSON, the lens silently dropped.

The fix was a brace-counting, escape-aware JSON walker that finds the first complete object and escapes raw newlines inside string values before parsing. Plus a 2,000-token output cap. Tactical resumed.

## What we learned

Three observations that may transfer to other RAG-corpus efforts:

1. **Augmentation has lens-specific failure modes.** Strategic answers are short and clean. Tactical answers are long and structured. Treating them as interchangeable in the parsing layer was the bug we shipped.

2. **Quality stratification is cheap and load-bearing.** Originals get quality=1.0. Evolved pairs get quality=0.85. Pairs caught by the source-leakage guard get quality=0.5 (invisible to retrieval). One numeric field, no schema migration, surfaces three distinct concerns simultaneously.

3. **Self-augmentation has a quality ceiling we haven't hit yet.** Conventional wisdom says synthetic data converges to lower quality than real data. At our scale (854 pairs) and our ratio (61% originals : 39% evolved) we don't see any retrieval quality regression. The thumbs-up rate from real users on Tuned answers is roughly flat across pre-evolution and post-evolution periods.

## What's next

By next month the corpus should clear 3,000 pairs at the current growth rate. The real test of whether evolution is actually working will be the retrieval similarity scores — if evolved pairs are matching at lower similarity than originals, they're noise. So far they're matching at parity.`,
  },

  {
    slug: "marketing-intel-taxonomy",
    title: "The Marketing Intel Taxonomy: a 13×13 schema for B2B content",
    category: "Whitepaper",
    summary:
      "Why we organized DMOOP's training corpus as a cross-product of 13 asset types and 13 marketing intents — and what we'd do differently if we were starting over.",
    readMinutes: 11,
    publishedAt: "2026-05-22",
    author: "DMOOP Research",
    content: `## Abstract

DMOOP organizes its marketing training corpus as a 13-asset-type × 13-intent matrix — a 169-cell taxonomy that drives both scraping coverage and retrieval ranking. This document walks through how the schema was designed, where it leaks, and what we'd structure differently if we were starting over today.

## Section 1 — Why a taxonomy at all

The naive approach to a marketing training corpus is "scrape a lot, dedupe, embed." This approach treats marketing knowledge as a single bag of unstructured text. It produces a model that knows everything about marketing in general and nothing about your specific task. A user asking "draft an ABM playbook for tier-1 accounts" and a user asking "explain Q3 attribution math" pull from the same undifferentiated pile.

A taxonomy lets retrieval discriminate. When a user's prompt classifies as "abm/playbook," the retrieval RPC can prefer pairs from the same cell. The Tuned model's answer inherits the structural shape that asset type implies — numbered steps for playbooks, Situation/Approach/Result for case studies, hook + CTA breakdown for social posts.

## Section 2 — The 13 asset types

We chose asset types from a structural axis, not a topical one. The question is: *what shape does this content have*, not *what is it about*. The 13:

| Asset type | Structural shape |
|---|---|
| article | Free-form journalistic prose with a thesis |
| report | Cited research with charts and benchmarks |
| case_study | Situation → Approach → Result with metrics |
| whitepaper | Long-form research with primary citations |
| playbook | Sequenced tactical steps with timing |
| ebook | Multi-chapter book-length guide |
| guide | How-to with hierarchical sections |
| template | Pre-filled framework with slot variables |
| social_post | Short hook + thread + CTA |
| ad_campaign | Insight → Creative → Channel → Result |
| newsletter | Curated recap with editorial commentary |
| podcast | Conversational long-form with quotes |
| video | Webinar / explainer with structured arguments |

The schema is intentionally orthogonal. A whitepaper about ABM has a different *shape* than a case study about ABM, even though both are about ABM. The Tuned model needs to learn both shapes.

## Section 3 — The 13 intents

Intents are topical. They answer "what is this marketing problem about." The 13: \`seo\`, \`aeo_geo\`, \`abm\`, \`buyer_signals\`, \`company_signals\`, \`demand_gen\`, \`ad_copy\`, \`email\`, \`analytics\`, \`competitor\`, \`orm\`, \`strategy\`, \`trend\`. Plus an implicit \`general\` fallback.

These cluster into four functional groups: pipeline (abm, buyer_signals, company_signals, demand_gen), content (ad_copy, email, seo, aeo_geo), measurement (analytics), and strategic (competitor, orm, strategy, trend). The grouping matters for routing: pipeline-tagged retrieval can prefer pairs that mention named platforms (6sense, Bombora, Mutiny); strategic-tagged retrieval can prefer pairs with budget tradeoff framing.

## Section 4 — Where the taxonomy leaks

Three places we wish we'd designed differently:

**Multi-intent content.** A "GTM playbook for SaaS" is plausibly \`strategy/playbook\` *and* \`demand_gen/playbook\`. We assign one intent at scrape time, picked by the Tavily query that surfaced it. Retrieval misses on the alternate framing. A multi-intent column with weights would fix this.

**Mixed-shape content.** Many real articles are 60% blog post + 30% case study + 10% playbook. We classify by the dominant shape, which means the case study material inside an "article" never gets retrieval boost when a case-study-shaped question comes in. A multi-asset-type label would help.

**Asset types we should retire.** Three asset types — \`ebook\`, \`podcast\`, \`video\` — produce <5% of our training pairs because Tavily can't crawl their primary distribution channels. We keep the labels because the structural shape is real and content does occasionally land. But we'd cap them at 5% of scrape budget instead of treating them as equally weighted.

## Section 5 — The cross-product

169 cells. In practice, ~110 are populated. The most productive: \`demand_gen/report\` (33 pairs), \`strategy/article\` (24), \`seo/report\` (21), \`analytics/report\` (19), \`orm/case_study\` (18). The least: most of the \`*/podcast\` and \`*/video\` row.

The distribution shape matters because retrieval ranking is a function of both similarity and density. A dense cell produces sharper similarity differentiation. A sparse cell produces wider similarity bands. If we were ranking strictly by similarity, sparse cells would dominate every retrieval — exactly the wrong outcome.

The RPC compensates with a composite score: \`similarity × 0.65 + intent_match × 0.25 + quality × 0.10\`. Intent match smooths out the density differential.

## Section 6 — What we'd do differently

If we were starting over:

1. **Multi-label** intent and asset_type from day one. Don't force a single value when content is plausibly two.
2. **Confidence weights** on each label. "70% playbook, 30% case study" is better than picking one.
3. **A "freshness" axis** separate from \`days\` query parameter. A 2-year-old playbook on Google Ads bidding is still useful; a 2-month-old AEO article may already be stale.
4. **An explicit "evergreen" tag** for content that retrieval can downweight on freshness-sensitive queries without removing entirely.

The schema is the model's worldview. Designing it well is one of the highest-leverage things you can do in a domain-specific RAG system.`,
  },

  {
    slug: "responsible-ai-framework",
    title: "Responsible AI for marketing tools: a 4-layer framework",
    category: "Whitepaper",
    summary:
      "What 'enterprise-pitchable' AI safety actually looks like in production. Input moderation, output moderation, injection detection, PII redaction — and the order they should run in.",
    readMinutes: 10,
    publishedAt: "2026-05-30",
    author: "DMOOP Engineering",
    content: `## TL;DR

A defensible "Responsible AI" layer for a marketing tool needs four functions running on every chat: input moderation, output moderation, prompt-injection detection, and PII redaction on uploaded content. The order matters. The failure modes are subtle. Most enterprise checklists ask for these four; the gap between checkbox and working implementation is where teams lose trust.

## Why this matters

Enterprise security reviews of AI marketing tools converge on the same six questions:

1. Does it filter unsafe input from the user?
2. Does it filter unsafe output from the model?
3. Can the user override your system prompt with a prompt injection?
4. Where does customer PII go if it's in an uploaded brand document?
5. Are incidents logged with severity and excerpt?
6. Does any of this slow the response by more than a second?

A "yes" to all six is the table-stakes bar for procurement at any mid-market+ buyer. None of these are individually hard. Wiring them together so they all run on every chat turn, fail open under load, and don't dominate latency is the interesting engineering problem.

## Layer 1 — Input moderation

The model never sees an unfiltered user message. Before the chat route calls Groq, the user query passes through Llama Guard 4 (Meta's open-source guardrail model, hosted on Groq for sub-100ms latency). Llama Guard returns either "safe" or "unsafe" plus a hazard category code (S1-S14 from the MLCommons taxonomy).

We allow S13 (election content — marketers may discuss it). We block S1-S4 (violent crimes, sex-related crimes) and S9-S12 (weapons, hate, self-harm, sexual content). Categorical rules; not negotiable per-user.

When input is flagged, the user gets a polished refusal that names the category, not a generic "I can't help with that." Transparency about *what* was caught reduces support volume.

## Layer 2 — Prompt-injection detection

Distinct from input moderation. Injection isn't about *what* the user is asking — it's about whether the user is trying to override the system, exfiltrate the brand documents, or jailbreak the safety contract.

Two sublayers:

- **Regex pack** (~10 patterns): \`ignore previous instructions\`, \`reveal your system prompt\`, \`<|system|>\`, \`DAN\`, \`pretend you have no rules\`. Always runs. Cost: microseconds.
- **LLM judge** (Groq 8B-instant with a tight classifier prompt): catches paraphrased attempts the regex misses. Skipped on follow-up turns (mid-conversation refinement requests like "shorter version" were the dominant false positive). Skipped on messages under 80 chars (too short for plausible injection).

A flagged injection returns a refusal naming which pattern matched. Pattern names ("exfiltrate_brand_docs", "system_prompt_reveal") become the language of the admin incident log.

## Layer 3 — Output moderation

Same Llama Guard model, but now on the assistant's response. Runs as a sidecar after streaming completes — does NOT block the streaming experience. If the response is flagged, an inline warning appends below the answer and the incident is logged.

The right design choice here is "log and warn" rather than "block." Blocking output after the user has already seen it streaming is jarring; warning is honest. The vast majority of output-side flags are false positives where the user asked about, e.g., a competitor's defamation lawsuit and Llama Guard incorrectly flagged the answer as containing defamation.

## Layer 4 — PII redaction on uploads

The single most important layer for enterprise trust. When a user uploads a brand document (PDF/DOCX/XLSX/PPTX), customer PII inside that document needs to never reach the server. Solution: parse the document client-side in the browser, run a regex pack for SSNs, emails, phone numbers, IBANs, credit cards (with Luhn validation to avoid false positives on invoice numbers), and AWS-style API keys. Replace matches with \`[REDACTED:type]\` tokens. Only the redacted text leaves the browser.

The model's answer still understands the redacted token role ("contact [REDACTED:EMAIL] for pricing") so usefulness isn't destroyed. The browser console never logs raw PII even if the user has DevTools open. The Brand Library UI surfaces a green banner showing what was scrubbed before upload — "4 items in Brand_Guide.pdf: 3× email, 1× phone — raw PII never reached the server."

## Logging contract

Every incident across the four layers writes one row to a \`safety_incidents\` table with: \`kind\` (input_unsafe / output_unsafe / prompt_injection / pii_redacted), \`severity\` (low/medium/high), \`categories\` (hazard codes or pattern names), \`excerpt\` (first 500 chars), \`action_taken\` (blocked/sanitized/flagged/redacted), \`user_id\`, \`model\`, \`occurred_at\`. The admin Safety tab reads this with KPI strip + kind filter + chronological feed.

Every layer above has the same logging contract. That's the boring part of the work — and it's what enterprise procurement actually validates.

## Failure modes

Every layer fails open. If Llama Guard throws an exception, we treat the message as safe and let it through. The reasoning: a model that blocks legit traffic under load loses more trust than a model that occasionally serves a flagged message during an outage. The downside is incidents that occur during Groq downtime go unlogged. The accepted tradeoff.

## What doesn't go in this framework

Three things we explicitly don't ship:

1. **Watermarking generated content.** Marketing copy needs to be presentable as the user's own. Watermarking sabotages the use case.
2. **"AI-generated content" disclaimers in the output.** Same reason.
3. **Automated bias auditing.** This belongs in the model layer, not the application layer. We trust the base model's RLHF and surface anything our users explicitly flag via thumbs-down.

## What buyers ask next

After the four-layer checkbox is satisfied, the next question is always: *"can we see your incident log?"* The admin Safety tab gives a clean answer. After that: *"what happens when a flagged input belongs to a paying customer?"* The honest answer is the same as it would be for any SaaS — log the incident, surface to the admin, no special-case bypass. Buyers respect the consistency.`,
  },

  {
    slug: "llama-not-openai",
    title: "Why we're still betting on Llama, not OpenAI",
    category: "Blog",
    summary:
      "Six months of running production marketing AI on Groq + Llama vs the alternatives. The cost math, the latency math, the quality gap that closes monthly, and the fallback chain that keeps us shipped.",
    readMinutes: 6,
    publishedAt: "2026-05-15",
    author: "DMOOP Engineering",
    content: `Every six weeks someone asks why DMOOP isn't on GPT-5 or Claude 4.7 Sonnet. The answer is mostly economic, partly architectural, and entirely contingent. Here's the math.

## The cost gap is bigger than the model card suggests

GPT-5 at $1.25/M input + $10/M output is the standard premium-tier number. Claude 4.7 Sonnet is roughly the same. For a marketing chat that averages ~3,500 input + ~2,000 output tokens per turn, that's $0.024 per conversation. Sounds cheap until you do the math at scale.

Groq's Llama 4 Scout (17B MoE) is free at our usage tier. Free vs $0.024 is infinite ratio. Even if Scout's quality were 30% worse on the metrics that matter (which it isn't), we'd be running it.

The fallback chain — Scout → Kimi-k2 → 8B-instant — gives us four independent free-tier TPM buckets to draw from across the day. With four tiers totaling ~52K tokens/minute of free throughput, hitting an actual quota wall requires more than ~30 simultaneously active users. That's a problem we want to have.

## The quality gap closes monthly

Six months ago, GPT-4 had a real edge on multi-step reasoning. Today Llama 4 Scout matches it on most marketing-specific benchmarks. On the actual workload we measure — copywriting for B2B SaaS, ABM playbook drafting, GTM strategy responses — the thumbs-up/thumbs-down ratio is statistically indistinguishable between Scout and Claude Sonnet. We A/B tested for two weeks. The gap isn't there.

This is the part most "OpenAI is still 30% better" benchmark posts miss. The benchmarks (GPQA Diamond, MMLU Pro, AIME) measure PhD-level reasoning, math olympiad performance, and academic knowledge. Marketing is structured opinion writing with named frameworks. The benchmark gap doesn't transfer.

## The latency gap reverses

Groq's TTFT (time to first token) on Llama 4 Scout is consistently under 300ms. Claude Sonnet's is ~800ms. GPT-5's is ~1.2s. For a streamed response, the TTFT is what the user perceives as "the model started thinking" — and Groq is meaningfully faster.

The full-response latency on a 1,500-token answer: Groq ~3s, Claude ~5s, GPT-5 ~6s. For users hammering through quick iteration cycles ("shorter," "in US English," "as a deck"), 3s vs 6s compounds into a different product feel.

## The architectural commitment

If we'd built DMOOP on the OpenAI SDK with hard-coded GPT-5 model IDs, swapping providers later would require touching every chat-route file. Because the SDK shim is OpenAI-compatible and the model ID is a single env var, we can A/B test Groq vs Anthropic vs OpenAI on the same code path. The cost of being wrong about Llama is "change one env var." That asymmetry is the actual architectural argument.

## What would flip this

Three things would flip our model strategy:

1. **A paying enterprise customer requires SOC 2 attestation that includes the inference provider.** Groq has SOC 2; we'd verify the customer's specific compliance scope.
2. **Tool-calling reliability becomes the bottleneck.** Llama's function-calling is good but not yet on Claude's level. We don't depend on it today.
3. **Llama itself stops shipping competitive base models.** Meta has so far shipped roughly on Anthropic's cadence. Watching.

For now: free Llama via Groq, fallback chain for resilience, every dollar saved goes into corpus growth. The corpus is the moat, not the model.`,
  },

  {
    slug: "scraped-1402-articles",
    title: "What 1,402 scraped marketing articles taught us",
    category: "Blog",
    summary:
      "We pulled 1,402 marketing articles from across the public web over 8 weeks. The asset-type distribution shocked us. Three observations that should change how marketing content gets produced.",
    readMinutes: 5,
    publishedAt: "2026-06-02",
    author: "DMOOP Research",
    content: `Over the last eight weeks DMOOP's scraper pulled 1,402 marketing articles across 13 asset types and 13 marketing intents. Some of what we saw was expected. Some genuinely surprised us. Three observations worth your time.

## Observation 1 — Reports dominate. Everything else is noise.

The single most-scraped asset type is "report" — Gartner / Forrester / vendor benchmarks. Reports account for **38% of the corpus** despite being 1 of 13 asset types. The second-most: case studies at 18%. Articles at 11%. Whitepapers at 9%.

Everything below 5% — podcasts, videos, ebooks, social posts, ad campaigns — combined accounts for less than 12% of the corpus.

This isn't because we biased the scrape. The Tavily queries are roughly balanced across asset types. Reports dominate because *that's what gets published, indexed, and surfaces in search*. The marketing internet is shaped like a pyramid with reports at the wide base.

The implication for content marketers is uncomfortable: if you're optimizing your editorial calendar for blog posts and social posts (the conventional wisdom), you're competing in a 23% slice of the surface where attention compounds slowly. If you publish one solid benchmark report a quarter, you're in the 38% slice where citations accrete.

## Observation 2 — Tavily can't reach 70% of marketing content

Of the asset types we *want* to scrape — podcasts, webinars, LinkedIn posts, gated whitepapers, ebooks — Tavily reliably reaches maybe 30% of the surface area. The rest is behind login walls, behind audio/video formats Tavily doesn't process, or behind soft paywalls that return 200 OK to crawlers but render gated content to humans.

This is a structural fact about the public web, not a Tavily limitation. The most valuable marketing content has been moving into closed ecosystems for five years. The public-web corpus is increasingly dominated by SEO-optimized blog posts written for search ranking, not for marketers reading them.

The architectural response is to lean on user uploads. DMOOP's Brand Library exists in part because the most valuable content for any specific brand is content that lives on their own laptops, not on the public web.

## Observation 3 — Source diversity matters more than source authority

We track unique source URLs per intent. The intents with the most marketing-publication diversity (10+ unique source domains per scrape cycle) produce noticeably better training pair quality than the intents dominated by 2-3 dominant publishers.

The translation for content marketers: being one of 12 voices on a topic is a worse position than being one of 4. The 2-3 dominant publishers in your niche have already optimized for AI citations. The path to being cited is finding the niche where there are 4-8 voices and adding a substantive one.

This also explains why niche topics with low search volume are increasingly valuable. The top-10 marketing trend topics in Q2 each had 50+ unique source publishers writing about them — meaning any individual piece's citation odds are tiny. The 30 next-tier topics had 4-6 each, with concentration on a few dominant voices. That's the gap.

## What we're doing about it

Three internal shifts based on these observations:

1. **Reduce scraper coverage of saturated topics**, increase coverage of mid-tier topics where the publisher diversity is 4-8 voices.
2. **Stop expecting parity across asset types.** Cap podcast/video/social_post scrape budget at 5% rather than trying to compensate for low yield.
3. **Encourage Brand Library uploads** as the path to high-value content that the public web doesn't reach.

The public marketing web is more shaped by SEO incentives than by what marketers actually need. Knowing that changes where you spend attention.`,
  },
];

export function getResource(slug: string): Resource | undefined {
  return RESOURCES.find((r) => r.slug === slug);
}

export function listResources(): Resource[] {
  return [...RESOURCES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
