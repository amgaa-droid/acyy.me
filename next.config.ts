import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The floating dev badge sits on top of the bottom tab bar; errors still show in the overlay.
  devIndicators: false,
};

export default nextConfig;
