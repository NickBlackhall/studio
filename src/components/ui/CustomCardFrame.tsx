
"use client";

import React from 'react';

interface CustomCardFrameProps {
  texturePath: string; // Path to the texture, e.g., /textures/red-halftone-texture.png
  className?: string;
}

const CustomCardFrame: React.FC<CustomCardFrameProps> = ({ texturePath, className }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="redTexturePattern" patternUnits="userSpaceOnUse" width="100" height="100">
          {/* This assumes red-halftone-texture.png is designed to either be stretched to 100x100 
              or if it's a small tile, the width/height here should match its native dimensions 
              for proper tiling. For now, we're letting it stretch.
          */}
          <image href={texturePath} x="0" y="0" width="100" height="100" preserveAspectRatio="none"/>
        </pattern>
        <filter id="roughenFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="1" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.6" />
        </filter>
      </defs>

      {/* 1. Solid black background for the entire card area.
             Extends slightly beyond the visual border area to ensure coverage.
      */}
      <rect x="0" y="0" width="100" height="100" fill="#000000" />

      {/* 2. Red halftone texture, drawn *inside* the visual area of the inner border.
             Inner border path starts at x="6", y="6" with stroke-width="0.7".
             Visual inside x: 6 + (0.7/2) = 6.35
             Visual inside width: 88 - 0.7 = 87.3
      */}
      <rect
        x="6.35"
        y="6.35"
        width="87.3"
        height="87.3"
        fill="url(#redTexturePattern)"
      />

      {/* 3. Outer border (filtered black) */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        stroke="#000000" 
        strokeWidth="2.1"
        fill="none" 
        filter="url(#roughenFilter)"
      />
      {/* 4. Inner border (filtered black) */}
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        stroke="#000000"
        strokeWidth="0.7"
        fill="none"
        filter="url(#roughenFilter)"
      />
    </svg>
  );
};

export default CustomCardFrame;
