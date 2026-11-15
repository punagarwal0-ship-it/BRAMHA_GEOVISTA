import React from 'react';

interface BramhaIconProps {
  className?: string;
  size?: number;
}

/**
 * BramhaIcon renders the custom celestial satellite logo mark:
 * - 4-pointed gleam star at upper left
 * - Earth globe with longitude meridians and latitude parallels
 * - Sweeping dynamic orbital ellipse
 * - Orbiting satellite with solar panel arrays at upper right
 * Rendered in calibrated sage-green (#9ec8b9)
 */
export const BramhaIcon: React.FC<BramhaIconProps> = ({ className = 'h-8 w-8', size }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Bramha Logo"
    >
      {/* 4-Pointed Sparkle Gleam (Top-Left) */}
      <path
        d="M 16 12 C 16 18 11 22 5 22 C 11 22 16 26 16 32 C 16 26 21 22 27 22 C 21 22 16 18 16 12 Z"
        fill="#9ec8b9"
      />

      {/* Earth Globe Circle */}
      <circle
        cx="44"
        cy="56"
        r="24"
        stroke="#9ec8b9"
        strokeWidth="2.8"
        fill="#141415"
      />

      {/* Globe Longitude Meridians */}
      <line
        x1="44"
        y1="32"
        x2="44"
        y2="80"
        stroke="#9ec8b9"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse
        cx="44"
        cy="56"
        rx="12.5"
        ry="24"
        stroke="#9ec8b9"
        strokeWidth="2"
        fill="none"
      />

      {/* Globe Latitude Parallels */}
      <line
        x1="20"
        y1="56"
        x2="68"
        y2="56"
        stroke="#9ec8b9"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M 25 44 C 32 47 56 47 63 44"
        stroke="#9ec8b9"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 25 68 C 32 65 56 65 63 68"
        stroke="#9ec8b9"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Sweeping Dynamic Orbit Ring (Ellipse tilted at -28deg) */}
      <ellipse
        cx="46"
        cy="56"
        rx="43"
        ry="13"
        transform="rotate(-28 46 56)"
        stroke="#9ec8b9"
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
      />

      {/* Orbiting Satellite (Top-Right along orbit) */}
      <g transform="translate(77, 34) rotate(42)">
        {/* Central Satellite Body */}
        <rect
          x="-4"
          y="-4"
          width="8"
          height="8"
          rx="1"
          fill="#141415"
          stroke="#9ec8b9"
          strokeWidth="1.8"
        />
        {/* Satellite Sensor/Antenna */}
        <line
          x1="0"
          y1="4"
          x2="0"
          y2="6.5"
          stroke="#9ec8b9"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Left Solar Array */}
        <rect
          x="-15"
          y="-3.5"
          width="9"
          height="7"
          rx="0.8"
          fill="#141415"
          stroke="#9ec8b9"
          strokeWidth="1.5"
        />
        <line x1="-10.5" y1="-3.5" x2="-10.5" y2="3.5" stroke="#9ec8b9" strokeWidth="1" />
        {/* Right Solar Array */}
        <rect
          x="6"
          y="-3.5"
          width="9"
          height="7"
          rx="0.8"
          fill="#141415"
          stroke="#9ec8b9"
          strokeWidth="1.5"
        />
        <line x1="10.5" y1="-3.5" x2="10.5" y2="3.5" stroke="#9ec8b9" strokeWidth="1" />
        {/* Connecting Trusses */}
        <line x1="-6" y1="0" x2="-4" y2="0" stroke="#9ec8b9" strokeWidth="1.5" />
        <line x1="4" y1="0" x2="6" y2="0" stroke="#9ec8b9" strokeWidth="1.5" />
      </g>
    </svg>
  );
};

interface BramhaLogoProps {
  showSubtitle?: boolean;
  version?: string;
  className?: string;
}

/**
 * Full Bramha Brand Lockup matching the official image:
 * [Logo Icon] | BRAMHA [v2.4]
 *               Earth observation, biogeochemical trends and predictive modeling
 */
export const BramhaLogo: React.FC<BramhaLogoProps> = ({
  showSubtitle = true,
  version = 'v2.4',
  className = ''
}) => {
  return (
    <div className={`flex items-center space-x-3.5 select-none ${className}`}>
      {/* Brand Icon Mark */}
      <div className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 flex items-center justify-center">
        <BramhaIcon className="h-10 w-10 sm:h-11 sm:w-11" />
      </div>

      {/* Subtle Vertical Divider */}
      <div className="h-8 w-[1px] bg-rule shrink-0" aria-hidden="true" />

      {/* Brand Typography & Tagline */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center space-x-2">
          <span className="font-sans font-bold text-lg sm:text-xl tracking-[0.14em] text-[#ededed] uppercase leading-tight">
            BRAMHA
          </span>
          <span className="px-2 py-0.5 rounded-full border border-[#9ec8b9]/40 bg-[#9ec8b9]/10 text-[#9ec8b9] text-[10px] sm:text-[11px] font-mono tabular-nums leading-none">
            {version}
          </span>
        </div>
        {showSubtitle && (
          <p className="text-[10px] text-muted-2 hidden sm:block leading-[1.3] mt-1 font-sans max-w-[210px]">
            Earth observation, biogeochemical trends and predictive modeling
          </p>
        )}
      </div>
    </div>
  );
};

