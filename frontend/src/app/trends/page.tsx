"use client";

import TopBar from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Filter, Bell, ExternalLink, ArrowUpRight } from "lucide-react";

const trends = [
  {
    id: 1, name: "AI-personalized packaging", velocity: "+240%", confidence: 87,
    category: "E-commerce", sentiment: "Positive", mentions: 142000,
    summary: "Brands using AI to generate individualized packaging designs per customer are seeing 34% higher unboxing video shares.",
    sources: ["Reddit r/ecommerce", "Shopify Blog", "Twitter/X"],
    age: "2h ago",
  },
  {
    id: 2, name: "Interactive video ads", velocity: "+310%", confidence: 91,
    category: "Paid Ads", sentiment: "Positive", mentions: 198000,
    summary: "Choose-your-own-adventure style video ad formats on TikTok and Instagram are driving 2.4× completion rates vs static.",
    sources: ["TikTok Creative Center", "Meta Ad Library", "Marketing Week"],
    age: "14h ago",
  },
  {
    id: 3, name: "Nostalgia marketing wave", velocity: "+180%", confidence: 79,
    category: "Social", sentiment: "Positive", mentions: 89000,
    summary: "Y2K and early 2010s aesthetic resurgence among Gen Z audiences. Brands referencing this era see +22% engagement lifts.",
    sources: ["Instagram public", "Reddit r/marketing", "Threads"],
    age: "5h ago",
  },
  {
    id: 4, name: "De-influencing backlash", velocity: "+90%", confidence: 65,
    category: "Influencer", sentiment: "Mixed", mentions: 55000,
    summary: "Consumer pushback against over-sponsored content is creating opportunity for authentic micro-influencer partnerships.",
    sources: ["TikTok scrape", "YouTube comments", "Twitter/X"],
    age: "1d ago",
  },
];

const categories = ["All", "E-commerce", "Social", "Paid Ads", "Influencer", "Content"];

export default function TrendsPage() {
  return (
    <>
      <TopBar title="Trend Intelligence" subtitle="Real-time trend detection across 50+ sources" />
      <main className="p-6 flex flex-col gap-6">

        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Trends detected (48h)", value: "23", icon: TrendingUp, color: "text-violet-600" },
            { label: "Avg confidence", value: "81%", icon: TrendingUp, color: "text-emerald-600" },
            { label: "Actionable alerts sent", value: "7", icon: Bell, color: "text-blue-600" },
            { label: "Trends acted on", value: "3", icon: ArrowUpRight, color: "text-amber-500" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5 pb-4 flex items-center gap-3">
                <s.icon size={22} className={s.color} />
                <div>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1">
            <Filter size={13} /> Filter
          </Button>
          {categories.map((c) => (
            <Badge
              key={c}
              variant={c === "All" ? "default" : "secondary"}
              className="cursor-pointer px-3 py-1 text-xs"
            >
              {c}
            </Badge>
          ))}
        </div>

        <Tabs defaultValue="emerging">
          <TabsList>
            <TabsTrigger value="emerging">Emerging</TabsTrigger>
            <TabsTrigger value="rising">Rising</TabsTrigger>
            <TabsTrigger value="peak">Peak</TabsTrigger>
            <TabsTrigger value="fading">Fading</TabsTrigger>
          </TabsList>

          <TabsContent value="emerging" className="mt-4 flex flex-col gap-4">
            {trends.map((t) => (
              <Card key={t.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{t.name}</h3>
                        <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>
                        <Badge
                          className={`text-[10px] ${t.sentiment === "Positive" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                        >
                          {t.sentiment}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 mb-3">{t.summary}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span><strong className="text-emerald-600">{t.velocity}</strong> velocity</span>
                        <span>{t.mentions.toLocaleString()} mentions</span>
                        <span>{t.age}</span>
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {t.sources.map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px] px-1.5">{s}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Confidence</p>
                        <p className="text-xl font-bold text-violet-700">{t.confidence}%</p>
                      </div>
                      <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-xs">
                        Generate Content
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs gap-1">
                        <ExternalLink size={11} /> Deep Dive
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="rising"><p className="text-sm text-slate-500 mt-4">No rising trends at this time.</p></TabsContent>
          <TabsContent value="peak"><p className="text-sm text-slate-500 mt-4">No peak trends at this time.</p></TabsContent>
          <TabsContent value="fading"><p className="text-sm text-slate-500 mt-4">No fading trends at this time.</p></TabsContent>
        </Tabs>

      </main>
    </>
  );
}
