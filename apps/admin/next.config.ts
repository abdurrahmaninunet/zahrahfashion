import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:4310";

const nextConfig: NextConfig = {
  // Preview/secondary instances build into their own dir so they never
  // clobber the primary dev server's chunks.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async rewrites() {
    // Proxy all API calls through the admin origin so the session cookie is
    // first-party and no CORS configuration is needed in the browser.
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${API_URL}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
