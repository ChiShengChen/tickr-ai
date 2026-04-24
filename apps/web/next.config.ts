import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow importing TS from sibling workspaces (packages/shared).
    externalDir: true,
  },
  transpilePackages: ['@signaldesk/shared'],
  webpack: (config) => {
    // Some wallet adapter deps ship CommonJS + Node polyfills. These two
    // are the common offenders in Solana front-end bundles.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
