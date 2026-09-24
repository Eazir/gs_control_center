import type { NextConfig } from 'next';

const isStandalone = process.env.STANDALONE === '1' || process.env.CI === 'true';

const nextConfig: NextConfig = {
  ...(isStandalone ? { output: 'standalone' } : {}),
  transpilePackages: ['@gs/contracts'],
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
