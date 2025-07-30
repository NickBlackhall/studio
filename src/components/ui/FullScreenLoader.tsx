"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';

interface FullScreenLoaderProps {
  message?: string;
}

export default function FullScreenLoader({ message = "Loading..." }: FullScreenLoaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
      <Loader2 className="h-12 w-12 animate-spin text-white mb-4" />
      <p className="text-lg text-white font-semibold">{message}</p>
    </div>
  );
}