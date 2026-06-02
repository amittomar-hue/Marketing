import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Host canonicalization (apex → www) is configured at the Vercel edge
  // in vercel.json's `redirects` block — runs BEFORE the Next function,
  // which is the only place Vercel's domain config can be overridden.
  // Keeping next.config.ts minimal so it doesn't fight that.
};

export default nextConfig;
