
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
      xmlnsXlink="http://www.w3.org/1999/xlink"
    >
      <defs>
        <filter id="roughenFilterUniqueCardFrame">
          {/* Adjusted filter parameters for a potentially more noticeable effect */}
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.3" />
        </filter>
        <clipPath id="cardClipPath">
          {/* This rect defines the clipping area, matching the outer border's shape */}
          <rect x="2" y="2" width="96" height="96" rx="8" ry="8" />
        </clipPath>
      </defs>
      {/* Background texture image, now clipped */}
      <image
        href={texturePath}
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
        strokeWidth="3" // Reduced from 4
        fill="none"
        filter="url(#roughenFilterUniqueCardFrame)"
      />
      {/* Inner border - reduced thickness */}
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="6"
        ry="6"
        stroke="#000000"
        strokeWidth="1" // Reduced from 1.5
        fill="none"
        filter="url(#roughenFilterUniqueCardFrame)"
      />
    </svg>
  );
};

export default CustomCardFrame;
