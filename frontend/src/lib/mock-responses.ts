import { ModelId } from "./models";

const AD_COPY_TEMPLATE = `Here are 3 ad copy variants for your campaign:

**Variant 1 — Direct Value Proposition**
• Headline: Stop Guessing. Start Converting.
• Body: Marketing teams using real-time intelligence see 40% higher engagement — with less effort.
• CTA: Start Free Trial
• Predicted CTR: 4.2% · Brand score: 89

**Variant 2 — Competitive Urgency**
• Headline: Your Competitors Are Moving Faster Than You.
• Body: Real-time trend intelligence means you're always first to market. Join 500+ growth teams.
• CTA: See How It Works
• Predicted CTR: 3.8% · Brand score: 84

**Variant 3 — Productivity Angle**
• Headline: 10× Your Content. Zero Extra Headcount.
• Body: Generate 50 pieces of on-brand content per week, per marketer. AI that learns from your wins.
• CTA: Book a Demo
• Predicted CTR: 5.1% · Brand score: 91

Want me to tighten any of these for a specific channel (Google Ads, LinkedIn, Meta)?`;

const TRENDS_TEMPLATE = `Here are the top trends I've detected in the last 48 hours, ranked by confidence:

**1. Interactive video ads** · +310% velocity · 91% confidence
Choose-your-own-adventure video formats on TikTok and Instagram are driving 2.4× completion rates vs. static creative. Strong opportunity for D2C brands.

**2. AI-personalized packaging** · +240% velocity · 87% confidence
Brands using AI-generated packaging per customer are seeing 34% higher unboxing video shares. Emerging in beauty and CPG.

**3. Nostalgia marketing wave** · +180% velocity · 79% confidence
Y2K and early 2010s aesthetic resurgence among Gen Z. Brands referencing this era see +22% engagement lifts.

**4. De-influencing backlash** · +90% velocity · 65% confidence
Consumer pushback against over-sponsored content. Opportunity for authentic micro-influencer partnerships.

Would you like me to generate a campaign brief for any of these?`;

const EMAIL_TEMPLATE = `Here's a 5-email sequence for your product launch:

**Email 1 — Welcome (Day 0)**
• Subject: You're in. Here's what happens next.
• Hook: Set expectations, build anticipation.

**Email 2 — Education (Day 2)**
• Subject: The 3 mistakes most marketers make
• Hook: Lead with insight, position your product as the solution.

**Email 3 — Social Proof (Day 5)**
• Subject: How [Customer] cut their CAC by 28%
• Hook: Concrete results from a relatable customer.

**Email 4 — Urgency (Day 8)**
• Subject: Last chance — early access closes Friday
• Hook: Scarcity + specific deadline.

**Email 5 — Final Call (Day 10)**
• Subject: Tonight at midnight
• Hook: Direct, no fluff, single CTA.

Each email is optimized for predicted open rates between 32-48%. Want me to write the full body copy for any of them?`;

const STRATEGY_TEMPLATE = `Based on the brief, here's a strategic recommendation:

**Positioning Angle**
Lead with your most defensible differentiator. Don't compete on volume or speed — those are commoditized. Instead, position around outcomes that compound (campaigns that get smarter over time).

**Target Audience**
Focus the first wave on marketing directors at $50M-$500M D2C brands. They have budget, feel competitive pressure, and have the decision-making authority to adopt new tooling without a 6-month procurement cycle.

**Channel Mix (90 days)**
1. LinkedIn thought leadership (40% effort) — buyer is here, signal-to-noise is favorable
2. Performance content marketing (30%) — long-tail SEO on "AI marketing" buyer queries
3. Paid demand generation (20%) — retarget engaged readers, not cold prospecting
4. Direct outreach (10%) — high-touch for top 50 ICP accounts

**Success Metrics**
• Pipeline created from content: 30% by day 90
• CAC: ≤ $3,200 (industry avg is $4,800)
• Time-to-value: < 14 days from signup to first generated campaign

What would you like to dig into first?`;

export function generateMockResponse(prompt: string, model: ModelId): string {
  const p = prompt.toLowerCase();

  if (/\b(ad|ads|ad copy|headline|google ads|meta)\b/.test(p)) return AD_COPY_TEMPLATE;
  if (/\b(trend|trending|whats hot|whats new|whats popular)\b/.test(p)) return TRENDS_TEMPLATE;
  if (/\b(email|sequence|newsletter|drip)\b/.test(p)) return EMAIL_TEMPLATE;
  if (/\b(strategy|plan|positioning|gtm|launch)\b/.test(p)) return STRATEGY_TEMPLATE;

  const speedNote =
    model === "marketing-haiku-4"
      ? "Quick take: "
      : model === "marketing-opus-4"
      ? "Here's a deeper analysis: "
      : "";

  return `${speedNote}I can help with that. Marketing LLM is built for marketing-specific tasks — try asking me to:

• **Generate ad copy** for Google Ads, Meta, or LinkedIn
• **Detect trends** across 50+ live sources updated every 15 minutes
• **Write an email sequence** for a product launch
• **Build a GTM strategy** for a new product or market
• **Score copy** against your brand voice profile
• **Analyze a competitor's** recent campaigns and propose counter-positioning

What would you like to start with?`;
}
