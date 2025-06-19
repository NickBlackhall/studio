
// import localFont from 'next/font/local'; // Commented out
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { LoadingProvider } from '@/contexts/LoadingContext';
import GlobalLoadingOverlay from '@/components/layout/GlobalLoadingOverlay';

// Configure Bangers font from local file - COMMENTED OUT
// const bangersFont = localFont({
//   src: '../../public/fonts/Bangers-Regular.ttf',
//   weight: '400',
//   variable: '--font-bangers', 
//   display: 'swap',
// });

// Configure Corben font from local file - COMMENTED OUT
// const corbenFont = localFont({
//   src: '../../public/fonts/Corben-Bold.ttf',
//   weight: '700',
//   variable: '--font-corben', 
//   display: 'swap',
// });

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
    // Removed font variables from className
    <html lang="en" className={``} suppressHydrationWarning={true}>
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
