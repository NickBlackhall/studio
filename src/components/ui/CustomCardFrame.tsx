
"use client";

import React from 'react';

interface CustomCardFrameProps {
  texturePath: string;
  className?: string;
}

const CustomCardFrame: React.FC<CustomCardFrameProps> = ({ texturePath, className }) => {
  return (
    <svg
      className={className} // Pass className for sizing/positioning from parent
      viewBox="0 0 100 100"
      preserveAspectRatio="none" // This will stretch the image
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink" // For href in <image>
    >
      <defs>
        {/* Unique filter ID to avoid clashes if multiple SVGs are on the page */}
        <filter id="roughenFilterUniqueCardFrame">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="1" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" />
        </filter>
      </defs>
      {/* Background texture image */}
      <image href={texturePath} x="0" y="0" width="100" height="100" preserveAspectRatio="none" />
      {/* Outer border */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="8"
        ry="8"
        stroke="#000000"
        strokeWidth="4" // JSX uses camelCase for attributes like strokeWidth
        fill="none"
        filter="url(#roughenFilterUniqueCardFrame)"
      />
      {/* Inner border */}
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="6"
        ry="6"
        stroke="#000000"
        strokeWidth="1.5" // JSX uses camelCase
        fill="none"
        filter="url(#roughenFilterUniqueCardFrame)"
      />
    </svg>
  );
};

export default CustomCardFrame;
