import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from "@/components/ui/toaster";
import { LoadingProvider } from '@/contexts/LoadingContext';
import { imFell, corben } from '@/lib/fonts';
import { cn } from '@/lib/utils';

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
    <html lang="en" className={`${imFell.variable} ${corben.variable}`} suppressHydrationWarning={true}>
      <body className={cn(
          "antialiased flex flex-col min-h-screen font-im-fell",
          // Ensure font is applied immediately to prevent FOUC
        )} suppressHydrationWarning={true}>
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
