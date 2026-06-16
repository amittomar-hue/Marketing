import type { Metadata } from "next";

// /brand is the user's Brand Library — uploaded private documents,
// authenticated only, never indexable.
export const metadata: Metadata = {
  title: "Brand Library",
  robots: { index: false, follow: false, nocache: true },
};

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return children;
}
