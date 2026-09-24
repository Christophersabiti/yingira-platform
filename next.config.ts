import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    turbopackFileSystemCacheForDev:
      process.env.YINGIRA_DISABLE_DISK_CACHE !== '1',
    turbopackFileSystemCacheForBuild:
      process.env.YINGIRA_DISABLE_DISK_CACHE !== '1',
  },
  turbopack: { root: process.cwd() },
  logging: { incomingRequests: false },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};
export default config;
