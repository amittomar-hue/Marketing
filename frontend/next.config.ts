import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Canonical-host redirect: every request that arrives at the apex
  // dmoop.com gets 308-redirected to www.dmoop.com (the canonical host),
  // preserving the path and query string. Consolidates SEO link equity
  // and matches the canonical URL declared in app/layout.tsx metadata.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "dmoop.com" }],
        destination: "https://www.dmoop.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
