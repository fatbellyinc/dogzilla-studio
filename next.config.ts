import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  // Prevent Turbopack from watching the SQLite data directory
  watchOptions: {
    pollIntervalMs: 1000,
  },
};

export default nextConfig;
