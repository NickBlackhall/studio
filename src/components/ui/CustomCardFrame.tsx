
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
      xmlnsXlink="http://www.w3.org/1999/xlink" // Ensure xlink namespace for href in image
    >
      <defs>
        <filter id="roughenFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="1" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.6" />
        </filter>
        
        <pattern id="redTexturePattern" patternUnits="userSpaceOnUse" width="100" height="100">
          {/* The image inside the pattern will be stretched to fill the pattern's 100x100 area */}
          <image href={texturePath} xlinkHref={texturePath} x="0" y="0" width="100" height="100" preserveAspectRatio="none"/>
        </pattern>

        <clipPath id="cardClipPath">
          {/* This clipPath is inset from the outer border's path */}
          <rect x="3.05" y="3.05" width="93.9" height="93.9" rx="6.95" ry="6.95" />
        </clipPath>
      </defs>

      {/* Background: A rectangle filled with the texture pattern, and clipped */}
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        fill="url(#redTexturePattern)"
        clipPath="url(#cardClipPath)"
      />

      {/* Outer border, drawn on top of the clipped background */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="8"
        ry="8"
        stroke="#000000"
        strokeWidth="2.1"
        fill="none"
        filter="url(#roughenFilter)"
      />
      {/* Inner border, also on top */}
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="6"
        ry="6"
        stroke="#000000"
        strokeWidth="0.7"
        fill="none"
        filter="url(#roughenFilter)"
      />
    </svg>
  );
};

export default CustomCardFrame;
