import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', 'argon2', 'pg'],
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ['*.e2b.app', '127.0.0.1', 'localhost'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/s/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'index,follow' }],
      },
      {
        source: '/preview/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex,nofollow,noarchive' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
