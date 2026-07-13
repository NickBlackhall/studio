
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import FontDebugger from '@/components/layout/FontDebugger';
import { AudioProvider } from '@/contexts/AudioContext';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { SharedGameProvider } from '@/contexts/SharedGameContext';
import MusicPlayer from '@/components/layout/MusicPlayer';
import UnifiedTransitionOverlay from '@/components/ui/UnifiedTransitionOverlay';
import UpdateBanner from '@/components/UpdateBanner';
import ErrorBoundary from '@/components/ErrorBoundary';
import DebugPanel from '@/components/DebugPanel';


export const metadata: Metadata = {
  manifest: '/manifest.json',
  title: 'Make It Terrible',
  description: 'The game of terrible choices and hilarious outcomes!',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Make It Terrible',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512x512.png" />
      </head>
      <body className={cn("antialiased")} suppressHydrationWarning={true}>
        <ErrorBoundary>
          <LoadingProvider>
            <AudioProvider>
              <SharedGameProvider>
                {/* Everything the player sees lives inside the frame, overlays
                    included, so nothing spills onto the letterbox on desktop. */}
                <div className="phone-frame">
                  <main className="flex h-full flex-col">
                    {children}
                  </main>
                  <Toaster />
                  <MusicPlayer />
                  <UnifiedTransitionOverlay />
                  <UpdateBanner />
                  <DebugPanel />
                </div>
              </SharedGameProvider>
            </AudioProvider>
          </LoadingProvider>
        </ErrorBoundary>
        <FontDebugger />
      </body>
    </html>
  );
}
