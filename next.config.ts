import type { NextConfig } from "next";
import { brandIcons } from "./config/site";

const nextConfig: NextConfig = {
  // Browsers and crawlers ask for /favicon.ico regardless of what <head>
  // declares. The canonical file lives in /public/brand with the rest of the
  // brand assets, so serve it from there instead of keeping a second copy at
  // the root that could drift.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: brandIcons.favicon }];
  },
};

export default nextConfig;
