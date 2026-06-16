// ─────────────────────────────────────────────────────────────────
// /robots.txt — Next.js auto-generates this file from the export
// below. Allows crawlers on the public marketing site + blog
// (/, /resources, /resources/[slug]) and disallows authenticated
// surfaces (/chat, /admin, /agents, /brand) so they never show up
// in search results even if a link leaks. /api routes are also
// disallowed because none of them are intended to be crawled.
//
// Each major search engine + AI crawler is named explicitly so we
// can apply differentiated rules later if needed — for now they all
// get the same disallow list, plus an explicit allow for the public
// pages so a misconfigured user-agent rule can't accidentally block
// us from the marketing surface.
// ─────────────────────────────────────────────────────────────────

import type { MetadataRoute } from "next";

const SITE_URL = "https://www.dmoop.com";

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/chat",
    "/chat/",
    "/admin",
    "/admin/",
    "/agents",
    "/agents/",
    "/brand",
    "/brand/",
    "/signin",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/",
    "/api/",
  ];

  const allow = ["/", "/resources", "/resources/"];

  return {
    rules: [
      { userAgent: "*",                  allow, disallow },
      { userAgent: "Googlebot",          allow, disallow },
      { userAgent: "Bingbot",            allow, disallow },
      { userAgent: "GPTBot",             allow, disallow }, // OpenAI
      { userAgent: "ChatGPT-User",       allow, disallow }, // OpenAI Browse
      { userAgent: "Google-Extended",    allow, disallow }, // Gemini training
      { userAgent: "PerplexityBot",      allow, disallow },
      { userAgent: "ClaudeBot",          allow, disallow }, // Anthropic crawler
      { userAgent: "anthropic-ai",       allow, disallow },
      { userAgent: "CCBot",              allow, disallow }, // CommonCrawl
      { userAgent: "Applebot",           allow, disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
