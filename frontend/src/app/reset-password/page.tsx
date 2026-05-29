"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Loader2, Lock, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/signin?reset=success");
  };

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
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-1.5">Set a new password</h1>
            <p className="text-[13.5px] text-[var(--dmoop-text-secondary)]">Pick something strong — minimum 8 characters</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--dmoop-text-tertiary)] pointer-events-none" />
              <input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-[14px] focus:outline-none focus:border-[var(--dmoop-accent)] focus:ring-4 focus:ring-[var(--dmoop-accent)]/10 transition-all" />
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--dmoop-text-tertiary)] pointer-events-none" />
              <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-[14px] focus:outline-none focus:border-[var(--dmoop-accent)] focus:ring-4 focus:ring-[var(--dmoop-accent)]/10 transition-all" />
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading || !password || !confirmPassword}
              className="h-11 rounded-xl dmoop-btn-primary text-[14px] font-semibold flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Updating…</> : "Update password"}
            </button>
          </form>

          <p className="text-center text-[13px] text-[var(--dmoop-text-secondary)] mt-6">
            <Link href="/signin" className="font-semibold text-[var(--dmoop-accent)] hover:text-[var(--dmoop-accent-rich)]">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
