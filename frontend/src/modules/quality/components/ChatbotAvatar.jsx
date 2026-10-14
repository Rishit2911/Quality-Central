import React, { useState } from 'react';

/**
 * ChatbotAvatar renders the official Quality Central AI Co-Pilot logo
 * based on the user's custom blue robot speech bubble brand asset.
 */
export default function ChatbotAvatar({ className = "w-6 h-6", size = 24, glow = false }) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    // High-fidelity vector SVG fallback matching the exact brand icon
    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} ${glow ? 'drop-shadow-[0_0_8px_rgba(0,102,255,0.6)]' : ''}`}
        style={{ width: size, height: size }}
      >
        {/* Outer Electric Blue Chat Bubble Container */}
        <path
          d="M24 6C14 6 6 14 6 24V60C6 70 14 78 24 78H38V94L54 78H76C86 78 94 70 94 60V24C94 14 86 6 76 6H24Z"
          fill="#0066FF"
        />
        {/* Inner White Robot Screen */}
        <rect x="18" y="16" width="64" height="50" rx="12" fill="#FFFFFF" />
        {/* Smiling Robot Blue Visor */}
        <path
          d="M28 36C42 42 58 42 72 36C75 35 76 39 74 43C64 54 36 54 26 43C24 39 25 35 28 36Z"
          fill="#0066FF"
        />
      </svg>
    );
  }

  return (
    <img
      src="/chatbot_logo.png"
      alt="Quality AI Copilot"
      onError={() => setImgError(true)}
      className={`object-contain select-none ${className} ${glow ? 'drop-shadow-[0_0_10px_rgba(0,102,255,0.5)]' : ''}`}
      style={{ width: size, height: size }}
      loading="eager"
    />
  );
}
