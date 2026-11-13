import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (and Partial Prefetching, which depends on it) stay off: OpenNext on
  // Cloudflare Workers has open issues with them on Next 16 (hangs / 500s). Pages fetch their
  // data in the browser anyway, so nothing here relies on them.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Lets `next dev` see Cloudflare bindings (added by `@opennextjs/cloudflare migrate`).
import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
