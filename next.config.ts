
import type {NextConfig} from 'next';
import withPWA from 'next-pwa';

const nextConfig: NextConfig = {
  // Netlify sets COMMIT_REF to the deployed git SHA. Baking it in lets the
  // settings screen show which build a device is actually running — the fastest
  // way to spot a phone stuck on a stale PWA bundle.
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.COMMIT_REF || '').slice(0, 7) || 'dev',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:9003',
        'verbose-train-69p959w97j99h5jx9-9003.app.github.dev',
        '*.app.github.dev'
      ]
    }
  },
  // The art library is pre-sized WebP (max 1280px wide, matching the phone
  // frame at 3x DPR), so the optimizer has nothing left to do — and its
  // /_next/image?... URLs defeat the service-worker precache below, which
  // matches raw /ui/... paths. Serving the files as-is lets the precache
  // intercept every art request.
  images: {
    unoptimized: true,
  },
};

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // next-pwa puts .next/app-build-manifest.json in the precache manifest, but
  // Next 15 never serves that URL — it 404s, and one failed fetch aborts the
  // ENTIRE service-worker install (workbox precache is all-or-nothing), so no
  // caching happened at all. Known next-pwa + App Router incompatibility.
  buildExcludes: [/app-build-manifest\.json$/],
  // Art (ui/, backgrounds/, textures/, ~32MB of pre-sized WebP) is
  // precached deliberately: it downloads once in the background and every
  // screen paints from cache afterwards — on-demand caching caused visible
  // flicker/pop-in whenever the browser evicted an image mid-session. Audio
  // stays on-demand (runtimeCaching below); screenshots are dev-only.
  // Historical note: precaching was a disaster when the art was 208MB of
  // raw PNGs — it's fine now only because the library is WebP at phone size.
  publicExcludes: [
    '!Sound/**/*',
    '!screenshots/**/*',
  ],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
        },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-cache',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:mp3|wav|ogg)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'audio-cache',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
  ],
})(nextConfig);
