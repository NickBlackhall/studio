
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from "@/components/ui/toaster";
import { LoadingProvider } from '@/contexts/LoadingContext';

export const metadata: Metadata = {
  title: 'Make It Terrible',
  description: 'The game of terrible choices and hilarious outcomes!',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Make It Terrible',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <link
          rel="preload"
          href="/fonts/IMFellEnglishSC-Regular.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body className={`antialiased flex flex-col min-h-screen`} suppressHydrationWarning={true}>
        <LoadingProvider>
          <div className="flex min-h-screen w-full flex-col">
            <main className="flex-grow flex flex-col">
              {children}
            </main>
          </div>
          <Toaster />
        </LoadingProvider>
      </body>
    </html>
  );
}
