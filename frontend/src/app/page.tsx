import LandingPage from "@/components/landing/LandingPage";

const SITE_URL = "https://dmoop.com";

// ─────────────────────────────────────────────────────────────────
// JSON-LD structured data. Helps DMOOP get cited correctly by
// Google AI Overviews / Perplexity / ChatGPT / Bing Copilot — which
// is exactly what DMOOP itself sells to its users (AEO/GEO).
//
// Four schemas inlined:
//   1. Organization  — the company entity, logo, profiles
//   2. WebSite       — the site with SearchAction
//   3. SoftwareApplication — DMOOP as a marketing-AI SaaS product
//   4. FAQPage       — the most-asked questions about DMOOP
// ─────────────────────────────────────────────────────────────────

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}#organization`,
  name: "DMOOP",
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  description:
    "DMOOP is an enterprise marketing AI that handles SEO, AEO, GEO, ABM, ad copy, GTM strategy, and brand voice — grounded in continuously-scraped marketing intel and your uploaded brand documents.",
  foundingDate: "2026",
  sameAs: [
    "https://github.com/amittomar-hue/Marketing",
  ],
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}#website`,
  url: SITE_URL,
  name: "DMOOP",
  description: "Enterprise marketing AI grounded in your brand and live marketing intel.",
  publisher: { "@id": `${SITE_URL}#organization` },
  inLanguage: "en-US",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/chat?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

const APP_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}#app`,
  name: "DMOOP",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Marketing AI",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "Enterprise marketing AI for the full marketing surface — SEO, AEO, GEO, ABM, ad copy, GTM strategy, brand voice. Uploads brand docs, scrapes any URL, exports to PDF/Word/Excel/PowerPoint, and grounds every answer in 130+ marketing topics scraped every 6 hours.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier — sign up with email, no credit card.",
  },
  featureList: [
    "Brand Agent — upload brand docs, name your agent, generate on-voice assets",
    "Live site scraping — paste any URL, DMOOP fetches and grounds answers",
    "File analysis — PDF / Word / Excel / PowerPoint parsed locally in browser",
    "Multi-format export — answers exportable as PDF / DOCX / XLSX / PPTX / CSV",
    "4 specialized models — Apex (flagship), Core (recommended), Pulse (fast), Tuned (custom)",
    "130+ marketing topics × 13 asset types scraped every 6 hours",
    "Self-learning RLMO loop — thumbs-up promotes responses to retrieval examples",
    "Responsible AI guardrails — Llama Guard 4 moderation + prompt injection detection + PII redaction",
    "AEO / GEO / SEO — get cited by ChatGPT, Perplexity, Google AI Overviews, Gemini",
    "ABM playbooks — tier-1 enterprise sequences across email + LinkedIn + paid",
    "Buyer signal intelligence — intent data interpretation, predictive scoring",
    "Brand voice scoring — real-time copy scoring against your guidelines",
  ],
  publisher: { "@id": `${SITE_URL}#organization` },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}#faq`,
  mainEntity: [
    {
      "@type": "Question",
      name: "What is DMOOP?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "DMOOP is an enterprise marketing AI that handles the full marketing surface — SEO, AEO/GEO, ABM, ad copy, email sequences, GTM strategy, brand voice. Unlike generic AI tools, DMOOP grounds every answer in 130+ marketing topics scraped every 6 hours and in the brand documents you upload, so the output is on-voice and current.",
      },
    },
    {
      "@type": "Question",
      name: "How is DMOOP different from ChatGPT for marketing?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "Three differences: (1) DMOOP is grounded in a marketing-specific corpus that scrapes 130+ topics across 13 asset types every 6 hours, so its examples are current. (2) DMOOP's Brand Agent uses your uploaded brand documents as authoritative source, so answers match your voice. (3) DMOOP has live site scraping, multi-format export (PDF/Word/Excel/PowerPoint), and Responsible-AI guardrails (Llama Guard 4 + prompt injection detection + PII redaction).",
      },
    },
    {
      "@type": "Question",
      name: "What is AEO / GEO and how does DMOOP help?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "AEO (Answer Engine Optimization) targets Google AI Overviews / Bing Copilot. GEO (Generative Engine Optimization) targets ChatGPT, Claude, Perplexity, and Gemini citations. DMOOP audits content for AEO/GEO eligibility and produces structured answers with schema markup and citation-ready formats.",
      },
    },
    {
      "@type": "Question",
      name: "Is DMOOP free?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "Yes. DMOOP has a free tier with no credit card required. Sign up with email and start asking marketing questions in under 60 seconds.",
      },
    },
    {
      "@type": "Question",
      name: "What is the Brand Agent?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "Brand Agent is a named custom agent (you pick the name, e.g. 'Maya') that uses your uploaded brand documents — guidelines, ICP, past campaigns, messaging frameworks — as the source of truth for every generated asset. It comes with 9 templates: landing page, LinkedIn post, cold email, ad copy variants, whitepaper outline, blog post, sales deck, case study, newsletter.",
      },
    },
    {
      "@type": "Question",
      name: "Which AI models does DMOOP use?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "Four specialized models: Apex (flagship Llama 3.3 70B for complex strategy), Core (balanced workhorse — same base, default), Pulse (Llama 3.1 8B for fast iteration), Tuned (Llama 4 Scout 17B MoE with RAG over the continuously-learned training corpus). All models inherit a depth + format contract that demands specific tools, numbers, frameworks, and step-by-step tactics.",
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <LandingPage />
    </>
  );
}
