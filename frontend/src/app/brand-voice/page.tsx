"use client";

import { useState } from "react";
import TopBar from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Mic2, Upload, CheckCircle2, XCircle, AlertCircle, Plus } from "lucide-react";

const brands = [
  { id: 1, name: "Acme Co.", score: 89, examples: 72, status: "active" },
  { id: 2, name: "NovaBrand", score: 76, examples: 34, status: "training" },
];

const toneAttributes = [
  { label: "Confident", value: 88 },
  { label: "Conversational", value: 74 },
  { label: "Data-Driven", value: 91 },
  { label: "Urgent", value: 62 },
  { label: "Empathetic", value: 55 },
];

const prohibitedTerms = ["cheap", "guarantee", "best in class", "world-class", "synergy"];

const sampleTests = [
  { text: "Unlock 10× ROI with our proven system.", score: 92, pass: true },
  { text: "The cheapest, world-class solution for your team.", score: 38, pass: false },
  { text: "Data shows our customers reduce CAC by 28% on average.", score: 87, pass: true },
];

export default function BrandVoicePage() {
  const [activeBrand, setActiveBrand] = useState(brands[0]);
  const [testInput, setTestInput] = useState("");

  return (
    <>
      <TopBar title="Brand Voice" subtitle="Calibrate and enforce consistent brand tone across all generated content" />
      <main className="p-6 flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-6">

          {/* Brand selector */}
          <div className="col-span-1 flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  Brand Profiles
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Plus size={11} /> Add Brand
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {brands.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setActiveBrand(b)}
                    className={`text-left rounded-lg px-3 py-2.5 border transition-all ${activeBrand.id === b.id ? "border-violet-400 bg-violet-50" : "border-transparent hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{b.name}</span>
                      <Badge
                        className={`text-[10px] ${b.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {b.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress value={b.score} className="h-1.5 flex-1" />
                      <span className="text-xs font-medium text-violet-700">{b.score}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{b.examples} training examples</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Upload Guidelines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed rounded-lg p-5 flex flex-col items-center gap-2 text-center cursor-pointer hover:bg-slate-50">
                  <Upload size={20} className="text-slate-400" />
                  <p className="text-xs text-slate-500">Upload brand guidelines PDF or paste example copy</p>
                  <Button size="sm" variant="outline" className="text-xs mt-1">Browse files</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Brand detail */}
          <div className="col-span-2 flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mic2 size={14} className="text-violet-600" />
                  {activeBrand.name} — Voice Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-3">Tone Dimensions</p>
                  <div className="flex flex-col gap-2.5">
                    {toneAttributes.map((a) => (
                      <div key={a.label} className="flex items-center gap-3">
                        <span className="text-xs w-28 text-slate-600">{a.label}</span>
                        <Progress value={a.value} className="h-2 flex-1" />
                        <span className="text-xs w-8 text-right font-medium">{a.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Prohibited Terms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {prohibitedTerms.map((t) => (
                      <Badge key={t} variant="destructive" className="text-[10px] bg-red-100 text-red-600 hover:bg-red-100">
                        <XCircle size={10} className="mr-1" /> {t}
                      </Badge>
                    ))}
                    <Button variant="outline" size="sm" className="text-[10px] h-5 px-2">+ Add term</Button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Scoring threshold: <strong>75 / 100</strong></p>
                  <p className="text-[11px] text-slate-400">Content scoring below this threshold is blocked from generation output.</p>
                </div>
              </CardContent>
            </Card>

            {/* Live scorer */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Live Brand Voice Scorer</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <textarea
                  rows={3}
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                  placeholder="Paste any copy here to score it against this brand profile…"
                />
                <Button className="w-fit bg-violet-600 hover:bg-violet-700 text-xs">Score Copy</Button>

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-slate-600">Recent tests</p>
                  {sampleTests.map((s, i) => (
                    <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg text-xs ${s.pass ? "bg-emerald-50" : "bg-red-50"}`}>
                      {s.pass
                        ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        : <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      }
                      <span className="flex-1 text-slate-700">{s.text}</span>
                      <span className={`font-bold shrink-0 ${s.pass ? "text-emerald-600" : "text-red-500"}`}>{s.score}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
