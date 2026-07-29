import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
