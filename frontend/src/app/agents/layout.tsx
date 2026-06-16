import type { Metadata } from "next";

// /agents is user-scoped Brand Agent management — authenticated only,
// never indexable.
export const metadata: Metadata = {
  title: "Brand Agents",
  robots: { index: false, follow: false, nocache: true },
};

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
