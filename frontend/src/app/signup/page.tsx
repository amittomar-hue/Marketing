"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Loader2, Mail, Lock, User, AlertCircle, CheckCircle2 } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setLoading(false); return; }

    // If email confirmation disabled, session is created immediately
    if (data.session) {
      router.push("/chat");
      router.refresh();
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShellLite title="Check your inbox" subtitle="We've sent a confirmation link to your email">
        <div className="flex flex-col items-center gap-4 py-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "var(--dmoop-gradient-accent)", boxShadow: "var(--dmoop-shadow-accent)" }}>
            <CheckCircle2 size={26} className="text-white" />
          </div>
          <p className="text-center text-[13.5px] text-[var(--dmoop-text-secondary)] leading-relaxed">
            Click the link in the email to verify your account. Once verified, you can sign in.
          </p>
          <Link href="/signin" className="text-[13px] font-semibold text-[var(--dmoop-accent)] hover:text-[var(--dmoop-accent-rich)]">
            Back to sign in →
          </Link>
        </div>
      </AuthShellLite>
    );
  }

  return (
    <AuthShellLite title="Get started with DMOOP" subtitle="Create your account in seconds">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <InlineField icon={User} type="text" placeholder="Full name" value={fullName} onChange={setFullName} autoComplete="name" />
        <InlineField icon={Mail} type="email" placeholder="you@company.com" value={email} onChange={setEmail} autoComplete="email" />
        <InlineField icon={Lock} type="password" placeholder="Password (min 8 characters)" value={password} onChange={setPassword} autoComplete="new-password" />

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading || !email || !password || !fullName}
          className="h-11 rounded-xl dmoop-btn-primary text-[14px] font-semibold flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={15} className="animate-spin" /> Creating account…</> : "Create account"}
        </button>
      </form>

      <p className="text-center text-[13px] text-[var(--dmoop-text-secondary)] mt-6">
        Already have an account?{" "}
        <Link href="/signin" className="font-semibold text-[var(--dmoop-accent)] hover:text-[var(--dmoop-accent-rich)]">Sign in</Link>
      </p>
    </AuthShellLite>
  );
}

function AuthShellLite({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--dmoop-bg-app)" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none opacity-50"
        style={{ background: "radial-gradient(ellipse at top, rgba(193,74,42,0.12) 0%, transparent 70%)" }} />
      <div className="relative w-full max-w-md dmoop-fade-in">
        <div className="flex justify-center mb-7">
          <Image src="/dmoop-logo.png" alt="DMOOP" width={180} height={56} priority className="h-12 w-auto" />
        </div>
        <div className="p-6 sm:p-8 rounded-2xl" style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-xl)" }}>
          <div className="text-center mb-7">
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-1.5">{title}</h1>
            <p className="text-[13.5px] text-[var(--dmoop-text-secondary)]">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function InlineField({ icon: Icon, type, placeholder, value, onChange, autoComplete }: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  type: string; placeholder: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  return (
    <div className="relative">
      <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--dmoop-text-tertiary)] pointer-events-none" />
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required
        className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-[14px] focus:outline-none focus:border-[var(--dmoop-accent)] focus:ring-4 focus:ring-[var(--dmoop-accent)]/10 transition-all" />
    </div>
  );
}
