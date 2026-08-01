import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Legacy Excel workbooks are currently around 4 MB. Keep the proxy and
    // Server Action limits aligned with the 10 MB validation enforced by the
    // import routes so uploads are not rejected before reaching application
    // validation.
    proxyClientMaxBodySize: "10mb",
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Supabase browser credentials are intentionally public. Declaring them here
  // makes the same values available to Next's Proxy runtime and client bundle
  // during a Vercel production build.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
};

export default nextConfig;
