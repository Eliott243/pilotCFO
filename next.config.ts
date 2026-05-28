import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to serve /_next/* resources (HMR, client chunks) to the
  // local origins we open the app from. Without this, Next.js 16 blocks these
  // cross-origin dev requests by default, which prevents client hydration
  // (blank screen in the browser).
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.0.102"],
};

export default nextConfig;
