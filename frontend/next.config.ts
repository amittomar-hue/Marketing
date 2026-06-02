import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Canonical-host redirect: every request that arrives at www.dmoop.com
  // gets 308-redirected to dmoop.com (no-www), preserving the path and
  // query string. Keeps SEO link equity consolidated on a single host and
  // matches the canonical URL declared in app/layout.tsx metadata.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.dmoop.com" }],
        destination: "https://dmoop.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
