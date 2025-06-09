
"use client";

import React from 'react';

interface CustomCardFrameProps {
  texturePath: string;
  className?: string;
}

const CustomCardFrame: React.FC<CustomCardFrameProps> = ({ texturePath, className }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink" // Kept for broader compatibility, though href is preferred
    >
      <defs>
        <filter id="roughenFilterUniqueCardFrame">
          {/* Adjusted for finer, less pronounced effect */}
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="1" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.6" />
        </filter>
        <clipPath id="cardClipPath">
          {/* Defines the clipping area, matching the outer border's intended shape before filter */}
          <rect x="2" y="2" width="96" height="96" rx="8" ry="8" />
        </clipPath>
      </defs>
      {/* Background texture image, clipped */}
      <image
        href={texturePath} // Standard attribute for SVG 2
        xlinkHref={texturePath} // Fallback for older SVG 1.1 viewers/processors
        x="0"
        y="0"
        width="100"
        height="100"
        preserveAspectRatio="none"
        clipPath="url(#cardClipPath)"
      />
      {/* Outer border - reduced thickness */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="8"
        ry="8"
        stroke="#000000"
        strokeWidth="2.1" // Reduced from 3
        fill="none"
        filter="url(#roughenFilterUniqueCardFrame)"
      />
      {/* Inner border - reduced thickness */}
      <rect
        x="6" // Positioned relative to the outer border path and its stroke
        y="6"
        width="88" // (96 - 2*strokeWidthOuter) -> then adjust for inner spacing. Current: 96 - (2*2) - (2*2) if spacing = strokeOuter
        height="88"
        rx="6" // Slightly smaller radius for inner border
        ry="6"
        stroke="#000000"
        strokeWidth="0.7" // Reduced from 1
        fill="none"
        filter="url(#roughenFilterUniqueCardFrame)"
      />
    </svg>
  );
};

export default CustomCardFrame;
