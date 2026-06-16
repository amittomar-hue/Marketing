import type { Metadata } from "next";

// /admin is gated by middleware + admin-email allow-list — should
// never appear in search results even if a link leaks. The layout
// applies noindex/nofollow/nocache to every page under /admin.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
