
import localFont from 'next/font/local';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { LoadingProvider } from '@/contexts/LoadingContext';
import GlobalLoadingOverlay from '@/components/layout/GlobalLoadingOverlay';

// Configure Bangers font from local file
const bangersFont = localFont({
  src: './fonts/Bangers-Regular.ttf', // Path relative to this file (src/app/layout.tsx)
  weight: '400',
  variable: '--font-bangers',
  display: 'swap',
});

// Configure Corben font from local file
const corbenFont = localFont({
  src: './fonts/Corben-Bold.ttf', // Path relative to this file (src/app/layout.tsx)
  weight: '700', // Corben-Bold implies a bold weight
  variable: '--font-corben',
  display: 'swap',
});

export const metadata = {
  title: 'Make It Terrible',
  description: 'The game of terrible choices and hilarious outcomes!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bangersFont.variable} ${corbenFont.variable}`} suppressHydrationWarning={true}>
      <body className={`antialiased flex flex-col min-h-screen`} suppressHydrationWarning={true}>
        <LoadingProvider>
          <main className="flex-grow container mx-auto p-4">
            {children}
          </main>
          <Toaster />
          <GlobalLoadingOverlay />
        </LoadingProvider>
      </body>
    </html>
  );
}
