"use client";

import { useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  content: string;
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = String(children ?? "").replace(/\n$/, "");
  const lang = className?.replace("hljs language-", "").replace("language-", "") || "text";

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden bg-[#1c1815] border border-[#2a2522] shadow-[var(--dmoop-shadow-md)]">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#241f1c] border-b border-[#2a2522]">
        <span className="text-[10.5px] font-semibold tracking-wider uppercase text-[#a89685]">
          {lang}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-medium text-[#c9b7a4] hover:text-white hover:bg-white/10 transition-colors"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="px-4 py-3 overflow-x-auto text-[13px] leading-[1.65] text-[#e8d9c5]">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

function Markdown({ content }: MarkdownProps) {
  return (
    <div className="dmoop-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-[20px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mt-5 mb-2 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[17px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mt-5 mb-2 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[15px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mt-4 mb-1.5 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[14px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mt-3 mb-1 first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-2.5 leading-[1.7] text-[var(--dmoop-text-primary)] first:mt-0 last:mb-0">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--dmoop-text-primary)]">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-[var(--dmoop-text-primary)]">{children}</em>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--dmoop-accent)] hover:text-[var(--dmoop-accent-rich)] underline underline-offset-2 decoration-[var(--dmoop-accent)]/40 hover:decoration-[var(--dmoop-accent)] transition-colors"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="my-2.5 ml-5 flex flex-col gap-1 list-disc marker:text-[var(--dmoop-text-tertiary)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 ml-5 flex flex-col gap-1 list-decimal marker:text-[var(--dmoop-text-tertiary)] marker:font-medium">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-[1.65] text-[var(--dmoop-text-primary)] pl-1">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-3.5 border-l-[3px] border-[var(--dmoop-accent)] bg-[#fbf3ee]/50 py-1.5 rounded-r-md italic text-[var(--dmoop-text-secondary)]">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="my-4 border-0 h-px bg-gradient-to-r from-transparent via-[var(--dmoop-border-soft)] to-transparent" />
          ),
          code: ({ className, children, ...props }) => {
            // Block code: has a language className like "language-js"
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }
            return (
              <code
                className="px-1.5 py-0.5 rounded-md bg-[#f5f1ea] text-[var(--dmoop-accent-rich)] text-[0.88em] font-mono border border-[var(--dmoop-border-soft)]"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>, // CodeBlock provides its own <pre>
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-[var(--dmoop-border-soft)] shadow-[var(--dmoop-shadow-xs)]">
              <table className="w-full text-[13px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#f9f5ee] border-b border-[var(--dmoop-border-soft)]">
              {children}
            </thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-[var(--dmoop-border-soft)] last:border-0 hover:bg-[#fbf8f4] transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[var(--dmoop-text-secondary)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-[var(--dmoop-text-primary)] align-top">
              {children}
            </td>
          ),
          img: ({ src, alt }) => (
            <img
              src={typeof src === "string" ? src : undefined}
              alt={alt}
              className="my-3 rounded-xl border border-[var(--dmoop-border-soft)] shadow-[var(--dmoop-shadow-sm)] max-w-full"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
