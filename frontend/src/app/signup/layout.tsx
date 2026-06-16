import type { Metadata } from "next";

// Auth pages don't need to be indexed — see signin/layout.tsx for the
// reasoning. The homepage CTA drives signups, not Google.
export const metadata: Metadata = {
  title: "Sign Up",
  robots: { index: false, follow: false },
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
