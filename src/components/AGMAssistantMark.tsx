// src/components/AGMAssistantMark.tsx
import React, { useId } from 'react';

interface AGMAssistantMarkProps {
  className?: string;
  variant?: 'light' | 'dark' | 'monochrome';
}

/**
 * Ikon AGM Assistant: lencana bulat berisi tanda tanya bergradasi.
 * Dirancang tetap tajam pada 20-28px. API (className, variant) tidak berubah.
 */
export const AGMAssistantMark: React.FC<AGMAssistantMarkProps> = ({
  className = "w-5 h-5",
  variant = "light"
}) => {
  const uid = useId().replace(/:/g, '');
  const badgeId = `agm-badge-${uid}`;
  const markId = `agm-mark-${uid}`;

  const isMono = variant === 'monochrome';
  const isDark = variant === 'dark';

  // Palet
  const badgeFrom = isMono ? 'currentColor' : isDark ? '#ffffff' : '#1e293b';
  const badgeTo = isMono ? 'currentColor' : isDark ? '#e2e8f0' : '#0b1220';
  const markFrom = isMono ? 'currentColor' : isDark ? '#0f172a' : '#fbbf24';
  const markTo = isMono ? 'currentColor' : isDark ? '#334155' : '#d97706';
  const dotColor = isMono ? 'currentColor' : isDark ? '#b45309' : '#f59e0b';

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={badgeId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={badgeFrom} />
          <stop offset="100%" stopColor={badgeTo} />
        </linearGradient>
        <linearGradient id={markId} x1="0.2" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor={markFrom} />
          <stop offset="100%" stopColor={markTo} />
        </linearGradient>
      </defs>

      {/* Lencana bulat */}
      <circle
        cx="12"
        cy="12"
        r="10.25"
        fill={isMono ? 'none' : `url(#${badgeId})`}
        stroke={isMono ? 'currentColor' : 'none'}
        strokeWidth={isMono ? 1.4 : 0}
      />

      {/* Kilau atas untuk kesan dimensi */}
      {!isMono && (
        <path
          d="M6.1 7.5a7.3 7.3 0 0 1 8.4-3.35"
          fill="none"
          stroke={isDark ? '#64748b' : '#ffffff'}
          strokeOpacity="0.28"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}

      {/* Tanda tanya */}
      <path
        d="M9.35 9.55a2.65 2.65 0 1 1 3.5 2.5c-.62.27-1.12.88-1.12 1.56v.34"
        fill="none"
        stroke={isMono ? 'currentColor' : `url(#${markId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Titik tanda tanya */}
      <circle cx="11.73" cy="16.15" r="1.18" fill={dotColor} />
    </svg>
  );
};

export default AGMAssistantMark;
