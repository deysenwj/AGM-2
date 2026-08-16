// src/components/AGMAssistantMark.tsx
import React from 'react';

interface AGMAssistantMarkProps {
  className?: string;
  variant?: 'light' | 'dark' | 'monochrome';
}

export const AGMAssistantMark: React.FC<AGMAssistantMarkProps> = ({
  className = "w-5 h-5",
  variant = "light"
}) => {
  // Determine color scheme based on variant
  let primaryColor = "#0f172a"; // Deep Navy
  let accentColor = "#d97706";  // Warm Amber

  if (variant === 'dark') {
    primaryColor = "#ffffff";
    accentColor = "#f59e0b";
  } else if (variant === 'monochrome') {
    primaryColor = "currentColor";
    accentColor = "currentColor";
  }

  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Precision Geometric Monogram 'A' / Architectural Frame */}
      <path 
        d="M4 19L12 4L20 19" 
        stroke={primaryColor} 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      {/* Structural Crossbar */}
      <path 
        d="M8.5 14H15.5" 
        stroke={accentColor} 
        strokeWidth="2.5" 
        strokeLinecap="round" 
      />
      {/* Subtle Interaction Focal Point */}
      <circle 
        cx="12" 
        cy="9.5" 
        r="1.5" 
        fill={accentColor} 
      />
    </svg>
  );
};

export default AGMAssistantMark;
