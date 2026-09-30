import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The floating dev badge sits on top of the bottom tab bar; errors still show in the overlay.
  devIndicators: false,
  // Share cards read their Cyrillic fonts from disk at runtime.
  outputFileTracingIncludes: {
    "/api/share/[purchaseId]": ["./src/assets/fonts/**/*"],
  },
};

export default nextConfig;
