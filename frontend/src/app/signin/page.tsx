"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--dmoop-bg-app)" }} />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your DMOOP account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field icon={Mail} type="email" placeholder="you@company.com" value={email} onChange={setEmail} autoComplete="email" />
        <Field icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} autoComplete="current-password" />

        <div className="flex justify-end -mt-1">
          <Link href="/forgot-password" className="text-[12px] text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-accent)] transition-colors">
            Forgot password?
          </Link>
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading || !email || !password}
          className="h-11 rounded-xl dmoop-btn-primary text-[14px] font-semibold flex items-center justify-center gap-2 transition-all">
          {loading ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : "Sign in"}
        </button>
      </form>

      <p className="text-center text-[13px] text-[var(--dmoop-text-secondary)] mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-[var(--dmoop-accent)] hover:text-[var(--dmoop-accent-rich)]">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--dmoop-bg-app)" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none opacity-50"
        style={{ background: "radial-gradient(ellipse at top, rgba(193,74,42,0.12) 0%, transparent 70%)" }} />

      <div className="relative w-full max-w-md dmoop-fade-in">
        <div className="flex justify-center mb-7">
          <div className="relative">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={180} height={56} priority className="h-12 w-auto" />
          </div>
        </div>

        <div className="p-8 rounded-2xl"
          style={{
            background: "var(--dmoop-gradient-card)",
            border: "1px solid var(--dmoop-border-soft)",
            boxShadow: "var(--dmoop-shadow-xl)",
          }}>
          <div className="text-center mb-7">
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-1.5">{title}</h1>
            <p className="text-[13.5px] text-[var(--dmoop-text-secondary)]">{subtitle}</p>
          </div>
          {children}
        </div>

        <p className="text-center text-[11px] text-[var(--dmoop-text-tertiary)] mt-6 tracking-wide">
          Enterprise marketing intelligence, fine-tuned for you.
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, type, placeholder, value, onChange, autoComplete }: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  type: string; placeholder: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  return (
    <div className="relative">
      <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--dmoop-text-tertiary)] pointer-events-none" />
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required
        className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-[14px] text-[var(--dmoop-text-primary)] placeholder:text-[var(--dmoop-text-tertiary)] focus:outline-none focus:border-[var(--dmoop-accent)] focus:ring-4 focus:ring-[var(--dmoop-accent)]/10 transition-all" />
    </div>
  );
}
