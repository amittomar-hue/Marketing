"use client";

import TopBar from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Users, Clock } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const mviData = [
  { week: "W1", mvi: 1.0 }, { week: "W2", mvi: 1.3 }, { week: "W3", mvi: 1.5 },
  { week: "W4", mvi: 1.8 }, { week: "W5", mvi: 2.0 }, { week: "W6", mvi: 2.4 },
  { week: "W7", mvi: 2.7 }, { week: "W8", mvi: 2.9 },
];

const contentData = [
  { week: "W1", ai: 12, human: 30 }, { week: "W2", ai: 22, human: 28 },
  { week: "W3", ai: 35, human: 27 }, { week: "W4", ai: 48, human: 25 },
  { week: "W5", ai: 60, human: 22 }, { week: "W6", ai: 78, human: 20 },
  { week: "W7", ai: 90, human: 19 }, { week: "W8", ai: 112, human: 18 },
];

const roasData = [
  { month: "Jan", baseline: 3.1, withAI: 3.1 },
  { month: "Feb", baseline: 3.0, withAI: 3.3 },
  { month: "Mar", baseline: 3.2, withAI: 3.6 },
  { month: "Apr", baseline: 3.1, withAI: 3.8 },
  { month: "May", baseline: 3.0, withAI: 4.1 },
];

const topContent = [
  { title: "Stop Guessing. Start Converting.", type: "Google Ad", ctr: "5.1%", impressions: "124K", score: 91 },
  { title: "Summer launch email — subject line B", type: "Email", ctr: "38.4%", impressions: "15K", score: 88 },
  { title: "AI personalization thread — LinkedIn", type: "Social", ctr: "6.8%", impressions: "42K", score: 93 },
  { title: "Landing page hero — variant 3", type: "Landing Page", ctr: "4.2%", impressions: "89K", score: 85 },
];

export default function AnalyticsPage() {
  return (
    <>
      <TopBar title="Analytics" subtitle="Marketing Velocity Index · Content Performance · Model Health" />
      <main className="p-6 flex flex-col gap-6">

        {/* Summary KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "MVI (8-week)", value: "2.9×", delta: "+190%", icon: TrendingUp },
            { label: "AI content pieces", value: "457", delta: "last 8 weeks", icon: BarChart3 },
            { label: "Hours saved", value: "312h", delta: "vs. manual", icon: Clock },
            { label: "Avg ROAS lift", value: "+32%", delta: "vs. baseline", icon: Users },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="pt-5 pb-4 flex items-center gap-3">
                <k.icon size={20} className="text-violet-600 shrink-0" />
                <div>
                  <p className="text-xl font-bold">{k.value}</p>
                  <p className="text-[11px] text-slate-500">{k.label}</p>
                  <p className="text-[11px] text-emerald-600 font-medium">{k.delta}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="mvi">
          <TabsList>
            <TabsTrigger value="mvi">MVI Trend</TabsTrigger>
            <TabsTrigger value="content">Content Output</TabsTrigger>
            <TabsTrigger value="roas">ROAS Impact</TabsTrigger>
            <TabsTrigger value="top">Top Performers</TabsTrigger>
          </TabsList>

          <TabsContent value="mvi">
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Marketing Velocity Index Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={mviData}>
                    <defs>
                      <linearGradient id="mviGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 4]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="mvi" stroke="#7c3aed" fill="url(#mviGrad)" strokeWidth={2} name="MVI" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content">
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">AI-Generated vs. Human Content per Week</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={contentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ai" fill="#7c3aed" name="AI-Generated" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="human" fill="#e2e8f0" name="Human-Written" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roas">
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">ROAS: AI-Assisted vs. Baseline</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={roasData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[2.5, 5]} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="withAI" stroke="#7c3aed" fill="#ede9fe" strokeWidth={2} name="With AI" />
                    <Area type="monotone" dataKey="baseline" stroke="#94a3b8" fill="#f8fafc" strokeWidth={1.5} strokeDasharray="5 5" name="Baseline" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top">
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top Performing AI Content</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {topContent.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{c.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{c.type}</Badge>
                          <span className="text-xs text-slate-500">{c.impressions} impressions</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-slate-500">CTR</p>
                          <p className="font-bold text-violet-700">{c.ctr}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Brand</p>
                          <p className={`font-bold ${c.score >= 90 ? "text-emerald-600" : "text-amber-500"}`}>{c.score}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>
    </>
  );
}
