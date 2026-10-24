import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep production output separate from the running dev server on Windows.
  distDir: process.env.NODE_ENV === 'production' ? '.next-production' : '.next',
  // Avoid concurrent static-output directory races on the local Windows disk.
  experimental: process.platform === 'win32' ? { cpus: 1, staticGenerationMaxConcurrency: 1 } : undefined,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        // These restrictions also apply to embedded players and their descendants.
        // Keep video/fullscreen/PiP APIs available; deny unrelated device features.
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), clipboard-read=(), clipboard-write=(), display-capture=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), midi=(), web-share=()',
        },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        // Protect VANTRA itself. This is not a script filter for provider frames.
        {
          key: 'Content-Security-Policy',
          value: "base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'self'",
        },
      ],
    }]
  },
  images: {
    qualities: [75, 85],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
      {
        protocol: 'https',
        hostname: 's4.anilist.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'wwcrlrsvyhbnpthwwdpd.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
