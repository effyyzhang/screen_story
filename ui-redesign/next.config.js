/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    return [
      {
        source: '/sessions/:path*',
        destination: '/api/sessions/:path*',
      },
    ]
  },
}

module.exports = nextConfig
