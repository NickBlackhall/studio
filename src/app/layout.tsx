
import localFont from 'next/font/local';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from "@/components/ui/toaster";
import { LoadingProvider } from '@/contexts/LoadingContext';
import GlobalLoadingOverlay from '@/components/layout/GlobalLoadingOverlay';

const imFellFont = localFont({
  src: '../../public/fonts/IMFellEnglishSC-Regular.ttf',
  variable: '--font-im-fell', 
  display: 'swap',
});

const corbenFont = localFont({
  src: '../../public/fonts/Corben-Regular.ttf',
  weight: '400',
  variable: '--font-corben', 
  display: 'swap',
});

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
    <html lang="en" className={`${imFellFont.variable} ${corbenFont.variable}`} suppressHydrationWarning={true}>
      <body className={`antialiased flex flex-col min-h-screen`} suppressHydrationWarning={true}>
        <LoadingProvider>
          <div className="flex min-h-screen w-full flex-col bg-background">
            <main className="flex-grow flex flex-col">
              {children}
            </main>
          </div>
          <Toaster />
          <GlobalLoadingOverlay />
        </LoadingProvider>
      </body>
    </html>
  );
}
