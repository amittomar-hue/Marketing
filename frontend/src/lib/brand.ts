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
  limit = 5
): Promise<BrandChunk[]> {
  const supa = getSupabase();
  if (!supa || !query || query.length < 3) return [];

  const { data, error } = await supa.rpc("retrieve_brand_chunks", {
    p_user_id: userId,
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
