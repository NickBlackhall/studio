
"use client";
import { useLoading } from '@/contexts/LoadingContext';
import { Loader2 } from 'lucide-react'; 

export default function GlobalLoadingOverlay() {
  const { isGlobalLoading } = useLoading();

  if (!isGlobalLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
      <p className="text-xl text-primary font-semibold">Loading the terribleness...</p>
      {/* Potential for fun messages later */}
    </div>
  );
}
