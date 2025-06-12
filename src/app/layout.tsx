
import type {Metadata} from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { LoadingProvider } from '@/contexts/LoadingContext';
import GlobalLoadingOverlay from '@/components/layout/GlobalLoadingOverlay';

const bangersFont = localFont({
  src: '../../public/fonts/Bangers-Regular.ttf', // Adjusted path assuming fonts are in public/fonts
  weight: '400',
  variable: '--font-bangers',
  display: 'swap', // Ensures text is visible while font loads
});

const corbenFont = localFont({
  src: '../../public/fonts/Corben-Bold.ttf', // Adjusted path assuming fonts are in public/fonts
  weight: '700', // Corben-Bold implies a bold weight
  variable: '--font-corben',
  display: 'swap', // Ensures text is visible while font loads
});

export const metadata: Metadata = {
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
