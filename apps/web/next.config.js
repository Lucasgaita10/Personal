/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '50mb' } },
  async rewrites() {
    return [
      { source: '/bff/:path*', destination: `${process.env.API_BASE_URL || 'http://localhost:4000'}/:path*` },
    ];
  },
};
module.exports = nextConfig;
