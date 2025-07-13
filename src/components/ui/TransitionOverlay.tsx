"use client";

import React from "react";
import { TransitionState } from "@/lib/types";

export default function TransitionOverlay({ 
  transitionState, 
  message 
}: { 
  transitionState: TransitionState; 
  message?: string | null; 
}) {
  if (transitionState === "idle") return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-white p-8 rounded-2xl text-center shadow-2xl flex flex-col items-center gap-4 text-black">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
        <p className="font-semibold text-xl">{message || "Loading..."}</p>
      </div>
    </div>
  );
}