import TopBar from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crosshair, AlertCircle, ExternalLink, Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";

const competitors = [
  {
    id: 1, name: "Acme Marketing AI", domain: "acme-ai.com",
    lastActivity: "2h ago", adsRunning: 14, contentFreq: "12/week",
    sentiment: "Aggressive", shareOfVoice: 23,
    recentCampaign: {
      headline: "Outpace Your Competitors With AI",
      angle: "Fear of missing out + competitor comparison",
      estimatedSpend: "$45K–$60K/mo",
      platforms: ["Google Ads", "LinkedIn"],
    },
    engagementDelta: "+8%",
    up: true,
  },
  {
    id: 2, name: "ContentForge", domain: "contentforge.io",
    lastActivity: "1d ago", adsRunning: 7, contentFreq: "6/week",
    sentiment: "Educational", shareOfVoice: 15,
    recentCampaign: {
      headline: "Generate 100 Blog Posts in 1 Hour",
      angle: "Volume + time savings, SEO-focused",
      estimatedSpend: "$20K–$30K/mo",
      platforms: ["Meta Ads", "Twitter/X"],
    },
    engagementDelta: "-3%",
    up: false,
  },
];

const alerts = [
  { competitor: "Acme Marketing AI", event: "Launched new Google Ads campaign targeting 'marketing automation'", time: "2h ago", severity: "high" },
  { competitor: "ContentForge", event: "Published 3 SEO articles targeting your core keywords", time: "1d ago", severity: "medium" },
  { competitor: "Acme Marketing AI", event: "Increased estimated ad spend by ~30% week-over-week", time: "3d ago", severity: "high" },
];

const counterStrategies = [
  "Lead with your RLMO differentiation — competitors can't claim models that self-improve from your own campaign data.",
  "Shift messaging to precision over volume: 'Right content, right moment' vs their 'more content faster' angle.",
  "Target the agency segment with multi-brand voice management — a gap neither competitor currently addresses.",
];

export default function CompetitivePage() {
  return (
    <>
      <TopBar title="Competitive Intelligence" subtitle="Monitoring 2 competitors · Updated every 24h" />
      <main className="p-6 flex flex-col gap-6">

        {/* Alert feed */}
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <AlertCircle size={14} /> Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <Badge className={`shrink-0 text-[10px] ${a.severity === "high" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                  {a.severity}
                </Badge>
                <span className="text-slate-700 flex-1"><strong>{a.competitor}:</strong> {a.event}</span>
                <span className="text-slate-400 shrink-0">{a.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Competitor cards */}
        <div className="flex flex-col gap-4">
          {competitors.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{c.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{c.domain}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{c.sentiment}</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mt-3 mb-4">
                      {[
                        { label: "Active Ads", value: c.adsRunning },
                        { label: "Content Freq.", value: c.contentFreq },
                        { label: "Share of Voice", value: `${c.shareOfVoice}%` },
                        { label: "Engagement Δ", value: c.engagementDelta, up: c.up },
                      ].map((m) => (
                        <div key={m.label} className="bg-slate-50 rounded-lg px-3 py-2">
                          <p className="text-[11px] text-slate-500">{m.label}</p>
                          <p className={`text-sm font-bold ${(m as any).up !== undefined ? ((m as any).up ? "text-red-500" : "text-emerald-600") : "text-slate-800"}`}>
                            {(m as any).up !== undefined && ((m as any).up ? <ArrowUpRight size={12} className="inline" /> : <ArrowDownRight size={12} className="inline" />)}
                            {m.value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-50 rounded-lg px-4 py-3">
                      <p className="text-[11px] font-medium text-slate-500 mb-1">Latest Campaign Detected · {c.lastActivity}</p>
                      <p className="text-sm font-semibold mb-0.5">"{c.recentCampaign.headline}"</p>
                      <p className="text-xs text-slate-600 mb-1">{c.recentCampaign.angle}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-500">Est. spend: <strong>{c.recentCampaign.estimatedSpend}</strong></span>
                        {c.recentCampaign.platforms.map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px] px-1.5">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-xs">
                      Generate Counter
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs gap-1">
                      <ExternalLink size={11} /> View Ads
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AI counter strategies */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Crosshair size={14} className="text-violet-600" />
              AI-Generated Counter Strategies
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {counterStrategies.map((s, i) => (
              <div key={i} className="flex gap-3 text-xs text-slate-700 bg-violet-50 rounded-lg px-4 py-3">
                <span className="font-bold text-violet-600 shrink-0">{i + 1}.</span>
                {s}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button variant="outline" className="gap-2 text-xs">
            <Plus size={12} /> Add Competitor
          </Button>
        </div>
      </main>
    </>
  );
}
