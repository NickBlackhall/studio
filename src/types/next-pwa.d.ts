declare module 'next-pwa' {
  import type { NextConfig } from 'next';
  interface RuntimeCaching {
    urlPattern: RegExp | string;
    handler: string;
    options?: Record<string, any>;
  }
  interface PWAConfig {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    runtimeCaching?: RuntimeCaching[];
    [key: string]: any;
  }
  export default function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;
}
