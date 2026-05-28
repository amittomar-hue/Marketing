import TopBar from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, Wand2, Target, Clock, ArrowUpRight, ArrowDownRight, Zap,
} from "lucide-react";

const kpis = [
  { label: "Trend Catch Rate", value: "74%", target: "80%", progress: 74, delta: "+4%", up: true },
  { label: "Avg Time-to-Campaign", value: "12 days", target: "10 days", progress: 60, delta: "-3 days", up: true },
  { label: "Content / Marketer", value: "38/wk", target: "50/wk", progress: 76, delta: "+8", up: true },
  { label: "Brand Safety Incidents", value: "0", target: "0", progress: 100, delta: "0", up: true },
];

const recentTrends = [
  { name: "AI-personalized packaging", confidence: 0.87, category: "E-commerce", velocity: "+240%", age: "2h ago" },
  { name: "Nostalgia marketing wave", confidence: 0.79, category: "Social", velocity: "+180%", age: "5h ago" },
  { name: "Micro-influencer ROI studies", confidence: 0.72, category: "Content", velocity: "+130%", age: "9h ago" },
  { name: "Interactive video ads", confidence: 0.91, category: "Paid", velocity: "+310%", age: "14h ago" },
];

const recentContent = [
  { title: "Summer ROAS Campaign — 5 ad variants", type: "Ad Copy", score: 88, time: "10m ago" },
  { title: "Product launch email sequence (7 emails)", type: "Email", score: 82, time: "1h ago" },
  { title: "LinkedIn thought leadership post", type: "Social", score: 91, time: "3h ago" },
];

export default function DashboardPage() {
  return (
    <>
      <TopBar title="Dashboard" subtitle="Marketing Velocity Index: 2.4× baseline" />
      <main className="p-6 flex flex-col gap-6">

        {/* KPI grid */}
        <div className="grid grid-cols-4 gap-4">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-slate-500 mb-1">{k.label}</p>
                <div className="flex items-end justify-between mb-3">
                  <span className="text-2xl font-bold">{k.value}</span>
                  <span className={`flex items-center text-xs font-medium ${k.up ? "text-emerald-600" : "text-red-500"}`}>
                    {k.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {k.delta}
                  </span>
                </div>
                <Progress value={k.progress} className="h-1.5" />
                <p className="text-[11px] text-slate-400 mt-1.5">Target: {k.target}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">

          {/* Trend feed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp size={14} className="text-violet-600" />
                Live Trend Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {recentTrends.map((t) => (
                <div key={t.name} className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t.category}</Badge>
                      <span className="text-xs text-emerald-600 font-medium">{t.velocity}</span>
                      <span className="text-xs text-slate-400">{t.age}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">Confidence</p>
                    <p className="text-sm font-bold text-violet-700">{(t.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent content */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wand2 size={14} className="text-violet-600" />
                Recently Generated
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {recentContent.map((c) => (
                <div key={c.title} className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{c.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{c.type}</Badge>
                      <span className="text-xs text-slate-400">{c.time}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">Brand Score</p>
                    <p className={`text-sm font-bold ${c.score >= 85 ? "text-emerald-600" : "text-amber-500"}`}>{c.score}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Model health strip */}
        <Card className="bg-violet-50 border-violet-200">
          <CardContent className="py-3 px-5 flex items-center gap-6">
            <Zap size={16} className="text-violet-600 shrink-0" />
            <div className="flex gap-8 flex-1 text-sm">
              <div><span className="text-slate-500">Last LoRA update:</span> <span className="font-medium">6h ago</span></div>
              <div><span className="text-slate-500">Model quality:</span> <span className="font-medium text-emerald-600">Passing</span></div>
              <div><span className="text-slate-500">Sources healthy:</span> <span className="font-medium">47 / 50</span></div>
              <div><span className="text-slate-500">RLMO cycles:</span> <span className="font-medium">12 completed</span></div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">All systems nominal</Badge>
          </CardContent>
        </Card>

      </main>
    </>
  );
}
