import { getSupabase } from "./supabase";

interface BrandChunk {
  chunk_id: string;
  doc_id: string;
  filename: string;
  doc_type: string;
  text: string;
  similarity: number;
}

/**
 * Split long text into overlapping chunks for retrieval.
 * Default: 1000-char chunks with 150-char overlap, prefer paragraph breaks.
 */
export function chunkText(text: string, chunkSize = 1000, overlap = 150): string[] {
  if (!text) return [];
  const cleaned = text.replace(/\r\n/g, "\n").trim();

  // Split on paragraph breaks first
  const paragraphs = cleaned.split(/\n{2,}/);
  const chunks: string[] = [];
  let buffer = "";

  for (const p of paragraphs) {
    if ((buffer + "\n\n" + p).length <= chunkSize) {
      buffer = buffer ? `${buffer}\n\n${p}` : p;
      continue;
    }
    if (buffer) chunks.push(buffer);
    if (p.length <= chunkSize) {
      buffer = p;
    } else {
      // Single paragraph is too long — slice with overlap
      let i = 0;
      while (i < p.length) {
        chunks.push(p.slice(i, i + chunkSize));
        i += chunkSize - overlap;
      }
      buffer = "";
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks.filter((c) => c.trim().length > 50);
}

export async function retrieveBrandChunks(
  userId: string,
  query: string,
  limit = 5,
  agentId: string | null = null
): Promise<BrandChunk[]> {
  const supa = getSupabase();
  if (!supa || !query || query.length < 3) return [];

  // p_agent_id NULL → RPC falls back to the user's default agent so
  // legacy callers (and any conversation without an explicit agent
  // binding) keep working without breaking.
  const { data, error } = await supa.rpc("retrieve_brand_chunks", {
    p_user_id: userId,
    p_agent_id: agentId,
    p_query: query.slice(0, 500),
    p_limit: limit,
  });
  if (error) {
    console.error("retrieveBrandChunks error:", error.message);
    return [];
  }
  return (data as BrandChunk[] | null) ?? [];
}

export function formatBrandContext(chunks: BrandChunk[]): string {
  if (chunks.length === 0) return "";

  const lines = [
    "USER'S BRAND DOCUMENTS — Use these as the source of truth for the user's brand voice, products, customers, and positioning. Treat anything here as authoritative about THEIR brand and adapt your response style + claims accordingly.",
    "",
  ];

  chunks.forEach((c, i) => {
    const sim = (c.similarity * 100).toFixed(0);
    lines.push(`[Brand-${i + 1}] from "${c.filename}" (${c.doc_type.replace("_", " ")}) — relevance ${sim}%`);
    lines.push(c.text.slice(0, 1500));
    lines.push("");
  });

  return lines.join("\n");
}

export const DOC_TYPES = [
  { value: "brand_guidelines", label: "Brand guidelines" },
  { value: "style_guide",      label: "Style / voice guide" },
  { value: "product_info",     label: "Product info / datasheet" },
  { value: "messaging",        label: "Messaging framework" },
  { value: "personas",         label: "ICP / personas" },
  { value: "case_study",       label: "Case study / past campaign" },
  { value: "sales_playbook",   label: "Sales playbook" },
  { value: "positioning",      label: "Positioning / competitive" },
  { value: "company_story",    label: "Company story / about" },
  { value: "general",          label: "Other / general" },
];

// ─────────────────────────────────────────────────────────────────
// Auto-classifier for the upload flow on /brand. Runs entirely in the
// browser after parseDocumentClient extracts the text. Scores each
// DOC_TYPES value against a small dictionary of filename + content
// keywords (filename hits weighted 3× since filenames carry intent)
// and returns the top scorer, falling back to "general" on a tie or
// zero matches. Conservative on purpose — when in doubt, defer to
// the user; the dropdown stays available as an override.
// ─────────────────────────────────────────────────────────────────

const TYPE_SIGNALS: Record<string, { filenamePatterns: RegExp[]; contentKeywords: string[] }> = {
  brand_guidelines: {
    filenamePatterns: [/\bbrand[-_\s]?(book|guide|guideline|kit)/i, /\bidentity\b/i, /\bguidelines?\b/i],
    contentKeywords: ["brand guidelines", "logo usage", "color palette", "brand book", "visual identity", "brand standards", "primary color", "typography"],
  },
  style_guide: {
    filenamePatterns: [/\b(style|voice|tone)[-_\s]?guide/i, /\bstyleguide\b/i, /\btov\b/i],
    contentKeywords: ["tone of voice", "we sound like", "we don't sound like", "voice and tone", "writing style", "vocabulary", "avoid these words", "preferred terms"],
  },
  product_info: {
    filenamePatterns: [/\bdatasheet\b/i, /\bspec(s|sheet)\b/i, /\bproduct[-_\s]?(info|sheet|overview|brief)/i, /\bfeatures?\b/i],
    contentKeywords: ["product overview", "key features", "specifications", "technical specs", "supported formats", "system requirements", "feature list", "capabilities"],
  },
  messaging: {
    filenamePatterns: [/\bmessag(ing|e)\b/i, /\bvalue[-_\s]?prop/i, /\b(narrative|story)[-_\s]?framework/i],
    contentKeywords: ["value proposition", "key messages", "messaging framework", "core message", "elevator pitch", "tagline", "proof points", "messaging pillars"],
  },
  personas: {
    filenamePatterns: [/\bpersona/i, /\bicp\b/i, /\bbuyer[-_\s]?(profile|persona)/i, /\baudience\b/i],
    contentKeywords: ["target customer", "buyer persona", "ideal customer profile", "demographics", "job title", "pain points", "decision maker", "user persona"],
  },
  case_study: {
    filenamePatterns: [/\bcase[-_\s]?stud/i, /\bsuccess[-_\s]?story/i, /\bcustomer[-_\s]?story/i, /\bcampaign\b/i, /\btestimonial/i],
    contentKeywords: ["challenge", "the solution", "results", "outcome", "before and after", "customer success", "increased by", "% improvement", "case study", "the customer"],
  },
  sales_playbook: {
    filenamePatterns: [/\bplaybook\b/i, /\bsales[-_\s]?(deck|enablement|script)/i, /\boutreach\b/i, /\bcadence\b/i],
    contentKeywords: ["sales playbook", "qualification framework", "objection handling", "discovery questions", "next steps", "outreach sequence", "call script", "BANT", "MEDDIC"],
  },
  positioning: {
    filenamePatterns: [/\bpositioning\b/i, /\bcompetit/i, /\bvs[-_\s]?(competitor|alternative)/i, /\bdifferentia/i],
    contentKeywords: ["competitive positioning", "vs competitor", "differentiation", "unlike alternatives", "category leader", "market positioning", "competitive advantage", "our edge"],
  },
  company_story: {
    filenamePatterns: [/\babout[-_\s]?(us|company)/i, /\bcompany[-_\s]?(story|history|overview)/i, /\bmanifesto\b/i, /\bmission\b/i],
    contentKeywords: ["our mission", "our vision", "founded in", "company history", "our story", "we believe", "our values", "why we exist", "our purpose"],
  },
};

/** Classify a brand document into one of the DOC_TYPES values based on
 *  filename + content signals. Returns "general" if no signal scores
 *  above zero, or if multiple types tie. */
export function classifyDocType(filename: string, text: string): string {
  const name = filename.toLowerCase();
  // Limit content scan to the first 8K chars — enough signal for any
  // real brand doc, keeps the regex pass under 1ms for huge files.
  const head = text.slice(0, 8000).toLowerCase();

  const scores: { type: string; score: number }[] = [];
  for (const [type, signals] of Object.entries(TYPE_SIGNALS)) {
    let score = 0;
    for (const pattern of signals.filenamePatterns) {
      if (pattern.test(name)) score += 3; // filename hits weighted higher
    }
    for (const kw of signals.contentKeywords) {
      if (head.includes(kw)) score += 1;
    }
    if (score > 0) scores.push({ type, score });
  }

  if (scores.length === 0) return "general";
  scores.sort((a, b) => b.score - a.score);
  // Tie at the top → defer to user, return general
  if (scores.length > 1 && scores[0].score === scores[1].score) return "general";
  return scores[0].type;
}
