"use client";

// ─────────────────────────────────────────────────────────────────
// Client-side document parser. Runs entirely in the browser so we
// bypass Vercel's 4.5MB serverless request body limit (the 413 cap)
// AND keep user files local — only the extracted text is ever sent
// to the server.
// ─────────────────────────────────────────────────────────────────

export interface ParseResult {
  ok: true;
  filename: string;
  size: number;
  ext: string;
  parser: string;
  text: string;
  char_count: number;
  page_count?: number;
  truncated: boolean;
  /** PII redaction summary — populated when scanForPii() was applied. */
  pii?: PiiSummary;
}

export interface PiiSummary {
  /** Total count across all types */
  total: number;
  /** Breakdown by type, e.g. { email: 4, phone: 2 } */
  by_type: Record<string, number>;
}

export interface ParseError {
  ok: false;
  error: string;
}

const MAX_BYTES = 50 * 1024 * 1024;  // 50 MB hard cap — generous since it's all local
const MAX_TEXT_CHARS = 80_000;       // server-side context limit, same as before

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "log",
  "html", "htm", "xml", "yml", "yaml", "rtf", "css", "js", "ts",
  "py", "sql", "sh", "ini", "conf", "env", "toml",
]);
const PDF_EXT  = new Set(["pdf"]);
const DOCX_EXT = new Set(["docx"]);
const XLSX_EXT = new Set(["xlsx", "xls", "xlsm", "xlsb", "ods"]);
const PPTX_EXT = new Set(["pptx", "ppt"]);
const ALL_EXT = new Set([
  ...TEXT_EXT, ...PDF_EXT, ...DOCX_EXT, ...XLSX_EXT, ...PPTX_EXT,
]);

// ─────────────────────────────────────────────────────────────────
// PII redaction. Runs entirely in the browser so customer PII in
// uploaded brand docs never reaches the server. Each match is
// replaced with [REDACTED:<type>] so the model still understands
// the slot's role in the text (e.g. "Contact [REDACTED:EMAIL] for
// pricing" reads correctly).
// ─────────────────────────────────────────────────────────────────

interface PiiPattern {
  name: string;
  re: RegExp;
  replacement: string;
}

// Luhn check for credit-card-shaped numbers — eliminates false
// positives on long invoice numbers, etc.
function luhnValid(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const PII_PATTERNS: PiiPattern[] = [
  // SSN — XXX-XX-XXXX (strict — common US format only)
  { name: "ssn",   re: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[REDACTED:SSN]" },
  // Email
  { name: "email", re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED:EMAIL]" },
  // Phone (US/international common shapes — avoid matching ISO dates)
  { name: "phone", re: /(?:\+?\d{1,2}[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, replacement: "[REDACTED:PHONE]" },
  // IBAN
  { name: "iban",  re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, replacement: "[REDACTED:IBAN]" },
  // IPv4
  { name: "ipv4",  re: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, replacement: "[REDACTED:IP]" },
  // AWS access keys / common API-key shapes
  { name: "aws_key", re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, replacement: "[REDACTED:AWS_KEY]" },
  // Generic "secret-looking" hex tokens 32+ chars (catches many API keys)
  { name: "api_key_hex", re: /\b[A-Fa-f0-9]{32,}\b/g, replacement: "[REDACTED:API_KEY]" },
];

// Credit cards run separately so we can Luhn-check before redacting.
const CC_RE = /\b(?:\d[ -]?){13,19}\b/g;

export function scanForPii(input: string): { redacted: string; summary: PiiSummary } {
  if (!input) return { redacted: input, summary: { total: 0, by_type: {} } };

  const by_type: Record<string, number> = {};
  let out = input;

  for (const { name, re, replacement } of PII_PATTERNS) {
    const matches = out.match(re);
    if (matches && matches.length > 0) {
      by_type[name] = (by_type[name] ?? 0) + matches.length;
      out = out.replace(re, replacement);
    }
  }

  // Credit cards: only redact if Luhn-valid
  out = out.replace(CC_RE, (match) => {
    if (luhnValid(match)) {
      by_type.credit_card = (by_type.credit_card ?? 0) + 1;
      return "[REDACTED:CC]";
    }
    return match;
  });

  const total = Object.values(by_type).reduce((a, b) => a + b, 0);
  return { redacted: out, summary: { total, by_type } };
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

async function extractPptxText(bytes: Uint8Array): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)![1], 10);
      const nb = parseInt(b.match(/slide(\d+)/)![1], 10);
      return na - nb;
    });

  const out: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    const text = xml
      .replace(/<a:br\/>/g, "\n")
      .replace(/<\/a:p>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) {
      out.push(`--- Slide ${i + 1} ---`);
      out.push(text);
    }
  }
  return out.join("\n");
}

export interface ParseOptions {
  /** Scan extracted text for PII and replace matches with [REDACTED:...] tokens
   *  before returning. Default: true. Brand uploads should always redact;
   *  chat attachments may opt out via `{ redactPii: false }`. */
  redactPii?: boolean;
}

export async function parseDocumentClient(
  file: File,
  options: ParseOptions = {}
): Promise<ParseResult | ParseError> {
  try {
    if (file.size > MAX_BYTES) {
      return { ok: false, error: `File too large. Max ${MAX_BYTES / 1024 / 1024} MB.` };
    }

    const name = file.name.toLowerCase();
    const ext = name.split(".").pop() ?? "";
    if (!ALL_EXT.has(ext)) {
      return { ok: false, error: `Unsupported file type: .${ext}` };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    let text = "";
    let pageCount: number | undefined;
    let parser = "";

    if (PDF_EXT.has(ext)) {
      parser = "unpdf";
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      pageCount = pdf.numPages;
      const result = await extractText(pdf, { mergePages: true });
      text = (Array.isArray(result.text) ? result.text.join("\n\n") : result.text) || "";
    } else if (DOCX_EXT.has(ext)) {
      parser = "mammoth";
      const mammoth = await import("mammoth");
      // mammoth's browser build accepts ArrayBuffer
      const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
      text = result.value;
    } else if (XLSX_EXT.has(ext)) {
      parser = "xlsx";
      const XLSX = await import("xlsx");
      const wb = XLSX.read(bytes, { type: "array" });
      const sheets: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
        if (csv.trim()) sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
      }
      text = sheets.join("\n\n");
    } else if (PPTX_EXT.has(ext)) {
      parser = "pptx-xml";
      text = await extractPptxText(bytes);
    } else if (ext === "html" || ext === "htm") {
      parser = "html-strip";
      text = stripHtmlTags(new TextDecoder("utf-8").decode(bytes));
    } else {
      parser = "utf8";
      text = new TextDecoder("utf-8").decode(bytes);
    }

    text = text.replace(/\s{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();

    const truncated = text.length > MAX_TEXT_CHARS;
    if (truncated) text = text.slice(0, MAX_TEXT_CHARS);

    // PII scan — defaults ON. The redacted text is what ships to the server.
    let pii: PiiSummary | undefined;
    if (options.redactPii !== false) {
      const result = scanForPii(text);
      text = result.redacted;
      pii = result.summary;
    }

    return {
      ok: true,
      filename: file.name,
      size: file.size,
      ext,
      parser,
      text,
      char_count: text.length,
      page_count: pageCount,
      truncated,
      pii,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `Parse failed: ${msg}` };
  }
}
