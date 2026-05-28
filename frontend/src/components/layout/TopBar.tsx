"use client";

import { Bell, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell size={16} />
          <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-violet-600">
            3
          </Badge>
        </Button>
        <Button variant="ghost" size="icon">
          <Search size={16} />
        </Button>
        <Button variant="ghost" size="icon">
          <Settings size={16} />
        </Button>
        <div className="h-8 w-8 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-medium ml-1">
          AM
        </div>
      </div>
    </header>
  );
}
