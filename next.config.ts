import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // typedRoutes: true,
    // Disabled until `next build` or `next dev` generates .next/types/app-router.d.ts.
    // Re-enable after the first build.
  },
  // Recharts (v3) ships ESM-only deps (d3 / victory-vendor) that must be
  // transpiled for the production build worker to resolve them.
  transpilePackages: ["recharts"],
  // Playwright (used by the invoice PDF route) is a heavy Node package with
  // native binaries (.node). It must be required at runtime, never bundled.
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@playwright/test",
    "fsevents",
    "chromium-bidi",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
