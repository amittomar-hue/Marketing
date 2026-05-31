import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 80_000;

// Supported file extensions grouped by parser
const TEXT_EXT = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "log",
  "html", "htm", "xml", "yml", "yaml", "rtf", "css", "js", "ts",
  "py", "sql", "sh", "ini", "conf", "env", "toml",
]);
const PDF_EXT = new Set(["pdf"]);
const DOCX_EXT = new Set(["docx"]);
const XLSX_EXT = new Set(["xlsx", "xls", "xlsm", "xlsb", "ods"]);
const PPTX_EXT = new Set(["pptx", "ppt"]);
const ALL_EXT = new Set([
  ...TEXT_EXT, ...PDF_EXT, ...DOCX_EXT, ...XLSX_EXT, ...PPTX_EXT,
]);

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
  // PPTX is a ZIP. Use JSZip to read /ppt/slides/slide*.xml.
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

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_BYTES / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    const name = file.name.toLowerCase();
    const ext = name.split(".").pop() ?? "";
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (!ALL_EXT.has(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: .${ext}`,
          supported: Array.from(ALL_EXT).sort(),
        },
        { status: 415 }
      );
    }

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
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      text = result.value;
    } else if (XLSX_EXT.has(ext)) {
      parser = "xlsx";
      const XLSX = await import("xlsx");
      const wb = XLSX.read(bytes, { type: "array" });
      const sheets: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
        if (csv.trim()) {
          sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
        }
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

    // Clean up whitespace
    text = text.replace(/\s{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();

    const truncated = text.length > MAX_TEXT_CHARS;
    if (truncated) text = text.slice(0, MAX_TEXT_CHARS);

    return NextResponse.json({
      ok: true,
      filename: file.name,
      size: file.size,
      ext,
      parser,
      text,
      char_count: text.length,
      page_count: pageCount,
      truncated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Parse failed: ${msg}` }, { status: 500 });
  }
}
