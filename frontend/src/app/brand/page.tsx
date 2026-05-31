"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Upload, FileText, Trash2, Loader2, BookOpen, AlertCircle, CheckCircle2, Wand2, Check } from "lucide-react";
import { DOC_TYPES } from "@/lib/brand";
import { useBrandAgentName } from "@/lib/brand-agent-name";
import { cn } from "@/lib/utils";

interface BrandDoc {
  id: string;
  filename: string;
  doc_type: string;
  total_chars: number;
  total_chunks: number;
  uploaded_at: string;
}

interface DocList {
  documents: BrandDoc[];
  total_documents: number;
  total_chars: number;
  total_chunks: number;
}

export default function BrandPage() {
  const [list, setList] = useState<DocList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [docType, setDocType] = useState<string>("brand_guidelines");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [agentName, setAgentName] = useBrandAgentName();
  const [draftName, setDraftName] = useState<string>("");
  const [savedTick, setSavedTick] = useState(false);

  useEffect(() => { setDraftName(agentName); }, [agentName]);

  const saveAgentName = () => {
    setAgentName(draftName);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
  };

  const load = async () => {
    const data = await fetch("/api/brand/documents").then((r) => r.json());
    setList(data);
  };

  useEffect(() => { load(); }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);

    try {
      // Step 1: Parse
      setProgress(`Parsing ${file.name}…`);
      const fd = new FormData();
      fd.append("file", file);
      const parseRes = await fetch("/api/parse-document", { method: "POST", body: fd });
      const parsed = await parseRes.json();
      if (!parseRes.ok) throw new Error(parsed.error ?? "Parsing failed");

      // Step 2: Store
      setProgress(`Indexing into brand library…`);
      const uploadRes = await fetch("/api/brand/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          text: parsed.text,
          doc_type: docType,
        }),
      });
      const result = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(result.error ?? "Upload failed");

      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      setProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteDoc = async (id: string, filename: string) => {
    if (!confirm(`Delete "${filename}"? DMOOP will stop using it as context.`)) return;
    await fetch("/api/brand/documents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  };

  const empty = (list?.total_documents ?? 0) === 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--dmoop-bg-app)" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[var(--dmoop-border-soft)] bg-white/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/chat" className="flex items-center gap-1.5 text-[12.5px] text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] transition-colors shrink-0">
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Back to chat</span>
            </Link>
            <span className="h-4 w-px bg-[var(--dmoop-border-soft)] hidden sm:block" />
            <Image src="/dmoop-logo.png" alt="DMOOP" width={100} height={32} className="h-6 sm:h-7 w-auto" />
            <span className="text-[10px] font-bold tracking-[0.12em] text-[var(--dmoop-accent)] uppercase px-1.5 sm:px-2 py-0.5 rounded-md shrink-0" style={{ background: "rgba(193,74,42,0.1)" }}>
              Brand
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Headline */}
        <div className="mb-6 dmoop-fade-in flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--dmoop-gradient-accent)", boxShadow: "var(--dmoop-shadow-accent)" }}>
            <BookOpen size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-[24px] sm:text-[28px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-tight">
              Brand Library
            </h1>
            <p className="text-[13px] sm:text-[14px] text-[var(--dmoop-text-secondary)] mt-1">
              Upload your brand guidelines, style guides, product info, past campaigns, or personas. DMOOP will use them as authoritative context in every response.
            </p>
          </div>
        </div>

        {/* Brand Agent name card */}
        <div className="rounded-2xl p-5 sm:p-6 mb-4"
          style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-md)" }}>
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#fbf3ee] flex items-center justify-center shrink-0">
              <Wand2 size={14} className="text-[var(--dmoop-accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-semibold text-[var(--dmoop-text-primary)]">Name your Brand Agent</p>
              <p className="text-[12px] text-[var(--dmoop-text-secondary)] mt-0.5">
                This name appears in the chat toolbar and Tools menu so your team knows which brand voice they&apos;re writing in.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveAgentName()}
              placeholder='e.g. "Acme Brand Voice"'
              maxLength={40}
              className="flex-1 min-w-0 h-10 px-3 rounded-lg text-[13px] bg-white border border-[var(--dmoop-border-soft)] focus:outline-none focus:border-[var(--dmoop-accent)] focus:ring-4 focus:ring-[var(--dmoop-accent)]/10"
            />
            <button
              onClick={saveAgentName}
              disabled={!draftName.trim() || draftName === agentName}
              className={cn(
                "h-10 px-4 rounded-lg text-[12.5px] font-semibold transition-all flex items-center justify-center gap-1.5 shrink-0",
                !draftName.trim() || draftName === agentName
                  ? "bg-[#f5f1ea] text-[var(--dmoop-text-tertiary)] cursor-not-allowed"
                  : "dmoop-btn-primary"
              )}
            >
              {savedTick ? <><Check size={13} /> Saved</> : "Save"}
            </button>
          </div>
        </div>

        {/* Upload card */}
        <div className="rounded-2xl p-5 sm:p-6 mb-6"
          style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-md)" }}>
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1">
              <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-1.5">
                Document type
              </label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-[13px] bg-white border border-[var(--dmoop-border-soft)] focus:outline-none focus:border-[var(--dmoop-accent)] focus:ring-4 focus:ring-[var(--dmoop-accent)]/10">
                {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div className="flex-1 sm:flex-[1.2]">
              <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-1.5">
                Upload file
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.xls,.pptx,.txt,.md,.csv,.json,.html,.htm,.xml,.yml,.yaml"
                onChange={handleFile}
                disabled={uploading}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "w-full h-10 rounded-lg flex items-center justify-center gap-2 text-[13px] font-semibold transition-all",
                  uploading
                    ? "bg-[#f5f1ea] text-[var(--dmoop-text-tertiary)] cursor-wait"
                    : "dmoop-btn-primary"
                )}
              >
                {uploading ? (
                  <><Loader2 size={14} className="animate-spin" /> {progress || "Processing…"}</>
                ) : (
                  <><Upload size={14} /> Choose file…</>
                )}
              </button>
            </div>
          </div>

          {err && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          <p className="text-[11.5px] text-[var(--dmoop-text-tertiary)] mt-3">
            Supports PDF, Word, Excel, PowerPoint, CSV, Markdown, and text files (up to 10MB each).
          </p>
        </div>

        {/* Quick stats */}
        {!empty && list && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Stat label="Documents" value={list.total_documents} />
            <Stat label="Chunks indexed" value={list.total_chunks} />
            <Stat label="Total content" value={`${(list.total_chars / 1000).toFixed(1)}K chars`} />
          </div>
        )}

        {/* Document list */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-md)" }}>
          <div className="px-5 py-3.5 border-b border-[var(--dmoop-border-soft)] flex items-center justify-between">
            <p className="text-[13.5px] font-semibold text-[var(--dmoop-text-primary)]">Your brand library</p>
            <span className="text-[10.5px] text-[var(--dmoop-text-tertiary)]">
              {list?.total_documents ?? 0} / 50 documents
            </span>
          </div>
          {empty ? (
            <div className="px-5 py-12 text-center">
              <BookOpen size={28} className="mx-auto text-[var(--dmoop-text-tertiary)] mb-3 opacity-40" />
              <p className="text-[13px] text-[var(--dmoop-text-secondary)] font-medium">
                No brand documents yet
              </p>
              <p className="text-[12px] text-[var(--dmoop-text-tertiary)] mt-1">
                Upload your first document above. DMOOP will use it on every chat to keep responses brand-aligned.
              </p>
            </div>
          ) : (
            list?.documents.map((d) => {
              const typeLabel = DOC_TYPES.find((t) => t.value === d.doc_type)?.label ?? d.doc_type;
              return (
                <div key={d.id} className="px-5 py-3.5 border-b border-[var(--dmoop-border-soft)] last:border-0 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#fbf3ee] flex items-center justify-center shrink-0">
                    <FileText size={15} className="text-[var(--dmoop-accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-[var(--dmoop-text-primary)] truncate">{d.filename}</p>
                    <div className="flex items-center gap-2 text-[10.5px] text-[var(--dmoop-text-tertiary)] mt-0.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded-md bg-[#f5f1ea] text-[var(--dmoop-text-secondary)] font-medium uppercase tracking-wide">
                        {typeLabel}
                      </span>
                      <span>{d.total_chunks} chunks</span>
                      <span>·</span>
                      <span>{(d.total_chars / 1000).toFixed(1)}K chars</span>
                      <span>·</span>
                      <span>{new Date(d.uploaded_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteDoc(d.id, d.filename)}
                    className="p-2 rounded-lg text-[var(--dmoop-text-secondary)] hover:bg-red-50 hover:text-red-600 transition-colors active:scale-95"
                    title="Delete document">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {!empty && (
          <div className="mt-5 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-[12.5px] text-emerald-800">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-600" />
            <span>
              <strong>Brand library is active.</strong> Every chat response now pulls the most relevant chunks from your documents and treats them as authoritative.
            </span>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl p-3.5"
      style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-sm)" }}>
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-1">{label}</p>
      <p className="text-[20px] font-semibold text-[var(--dmoop-text-primary)] tracking-tight">{value}</p>
    </div>
  );
}
