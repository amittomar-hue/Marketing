"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Wand2,
  Mic2,
  Crosshair,
  BarChart3,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/content", label: "Content Gen", icon: Wand2 },
  { href: "/brand-voice", label: "Brand Voice", icon: Mic2 },
  { href: "/competitive", label: "Competitive Intel", icon: Crosshair },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r bg-white flex flex-col min-h-screen">
      <div className="flex items-center gap-2 px-5 py-5 border-b">
        <Zap className="text-violet-600" size={22} />
        <span className="font-bold text-lg tracking-tight">Marketing LLM</span>
      </div>
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              path === href
                ? "bg-violet-50 text-violet-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-5 py-4 border-t text-xs text-slate-400">
        Phase 1 MVP · v0.1.0
      </div>
    </aside>
  );
}
