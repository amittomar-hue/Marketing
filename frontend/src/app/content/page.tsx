"use client";

import { useState } from "react";
import TopBar from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Copy, ThumbsUp, ThumbsDown, RotateCcw, Loader2 } from "lucide-react";

const channelTypes = [
  { id: "google_ads", label: "Google Ads" },
  { id: "meta", label: "Meta Ads" },
  { id: "email", label: "Email" },
  { id: "social", label: "Social Post" },
  { id: "landing_page", label: "Landing Page" },
  { id: "blog", label: "Blog / Article" },
];

const mockVariants = [
  {
    id: 1,
    headline: "Stop Guessing. Start Converting.",
    body: "Marketing teams using AI-assisted content see 40% higher engagement — with less effort. Start your free trial and generate your first campaign in minutes.",
    cta: "Start Free Trial",
    predictedCtr: "4.2%",
    brandScore: 89,
  },
  {
    id: 2,
    headline: "Your Competitors Are Moving Faster Than You.",
    body: "Real-time trend intelligence means you're always first to market. Join 500+ growth teams who've cut campaign time from 3 weeks to 3 days.",
    cta: "See How It Works",
    predictedCtr: "3.8%",
    brandScore: 84,
  },
  {
    id: 3,
    headline: "10× Your Content. Zero Extra Headcount.",
    body: "Generate 50 pieces of on-brand content per week, per marketer. Our AI learns from your wins — so every campaign gets smarter.",
    cta: "Book a Demo",
    predictedCtr: "5.1%",
    brandScore: 91,
  },
];

export default function ContentPage() {
  const [selectedChannel, setSelectedChannel] = useState("google_ads");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<typeof mockVariants>([]);

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      setVariants(mockVariants);
      setGenerating(false);
    }, 1800);
  };

  return (
    <>
      <TopBar title="Content Generation" subtitle="AI-powered multi-channel content at scale" />
      <main className="p-6 flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-6">

          {/* Input panel */}
          <div className="col-span-1 flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Campaign Brief</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Channel</label>
                  <div className="flex flex-wrap gap-1.5">
                    {channelTypes.map((c) => (
                      <Badge
                        key={c.id}
                        variant={selectedChannel === c.id ? "default" : "secondary"}
                        className="cursor-pointer text-xs px-2.5 py-1"
                        onClick={() => setSelectedChannel(c.id)}
                      >
                        {c.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Product / Offer</label>
                  <input
                    className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder="e.g. AI-powered marketing platform"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Target Audience</label>
                  <input
                    className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder="e.g. Marketing directors at D2C brands"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Tone / Angle</label>
                  <input
                    className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder="e.g. Urgent, data-driven, challenge the status quo"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Additional context</label>
                  <textarea
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                    placeholder="Key messaging, USPs, trending hooks to incorporate..."
                  />
                </div>
                <Button
                  className="w-full bg-violet-600 hover:bg-violet-700"
                  onClick={generate}
                  disabled={generating}
                >
                  {generating ? (
                    <><Loader2 size={14} className="mr-2 animate-spin" /> Generating…</>
                  ) : (
                    <><Wand2 size={14} className="mr-2" /> Generate 3 Variants</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Variants panel */}
          <div className="col-span-2 flex flex-col gap-4">
            {variants.length === 0 && !generating && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed rounded-xl">
                <Wand2 size={28} className="mb-3 opacity-40" />
                <p className="text-sm">Fill in the brief and click Generate</p>
              </div>
            )}

            {generating && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 size={28} className="mb-3 animate-spin text-violet-500" />
                <p className="text-sm">Generating variants…</p>
              </div>
            )}

            {variants.map((v) => (
              <Card key={v.id} className="border-l-4 border-l-violet-400">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-400">VARIANT {v.id}</span>
                        <Badge className={`text-[10px] ${v.brandScore >= 88 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          Brand score: {v.brandScore}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Predicted CTR: {v.predictedCtr}
                        </Badge>
                      </div>
                      <p className="font-bold text-sm mb-1">{v.headline}</p>
                      <p className="text-xs text-slate-600 mb-2">{v.body}</p>
                      <Badge variant="secondary" className="text-xs">CTA: {v.cta}</Badge>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button variant="outline" size="icon" className="h-7 w-7">
                        <Copy size={12} />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7 text-emerald-600">
                        <ThumbsUp size={12} />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7 text-red-400">
                        <ThumbsDown size={12} />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7">
                        <RotateCcw size={12} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
