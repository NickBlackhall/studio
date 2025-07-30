
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Only include experimental options in development
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      allowedDevOrigins: [
        'https://6000-firebase-studio-1748385878962.cluster-joak5ukfbnbyqspg4tewa33d24.cloudworkstations.dev',
        'https://9000-firebase-studio-1748385878962.cluster-joak5ukfbnbyqspg4tewa33d24.cloudworkstations.dev',
        'https://9003-firebase-studio-1748385878962.cluster-joak5ukfbnbyqspg4tewa33d24.cloudworkstations.dev'
      ],
    },
  }),
};

export default nextConfig;
