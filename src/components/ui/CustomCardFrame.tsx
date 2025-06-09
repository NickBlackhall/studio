
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
      xmlnsXlink="http://www.w3.org/1999/xlink" // Added for xlinkHref
    >
      <defs>
        <pattern id="redTexturePattern" patternUnits="userSpaceOnUse" width="100" height="100">
          {/* Using preserveAspectRatio="none" on the image within the pattern will stretch it.
              If red-halftone-texture.png is a tile, width/height here should be its native size.
              For now, we assume it's meant to stretch or is large enough.
           */}
          <image href={texturePath} x="0" y="0" width="100" height="100" preserveAspectRatio="none"/>
        </pattern>
        <filter id="roughenFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="1" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.6" />
        </filter>
        <clipPath id="cardClipPath">
          {/* Square clip path, aligned with the outer border's intended visual placement */}
          <rect x="2" y="2" width="96" height="96" />
        </clipPath>
      </defs>

      {/* Clipped texture rectangle. This draws the texture over a large area, then clips it. */}
      <rect x="0" y="0" width="100" height="100" fill="url(#redTexturePattern)" clipPath="url(#cardClipPath)"/>

      {/* Outer border (filtered black, square corners) */}
      <rect
        x="2" // Aligned with clipPath
        y="2" // Aligned with clipPath
        width="96" // Aligned with clipPath
        height="96" // Aligned with clipPath
        stroke="#000000"
        strokeWidth="2.1" // Thinner border
        fill="none"
        filter="url(#roughenFilter)"
      />
      {/* Inner border (filtered black, square corners) */}
      <rect
        x="6" // Offset from outer border
        y="6" // Offset from outer border
        width="88" // Smaller than outer border
        height="88" // Smaller than outer border
        stroke="#000000"
        strokeWidth="0.7" // Thinner inner border
        fill="none"
        filter="url(#roughenFilter)"
      />
    </svg>
  );
};

export default CustomCardFrame;
