/**
 * ============================================================================
 * ORCA Maritime Risk Indicator Component (src/components/RiskIndicator.jsx)
 * ============================================================================
 * Standardized SVG shape glyph indicator for maritime risk levels.
 *
 * Visual Accessibility Specifications:
 * - SAFE: Circle (Green)
 * - CAUTION: Diamond (Amber/Yellow)
 * - UNSAFE: Triangle (Orange)
 * - DANGEROUS: Octagon (Red)
 * - UNRATED / UNKNOWN: Dashed Ring (Muted)
 *
 * Uses explicit 12x12 SVG paths rather than Unicode characters (such as U+2BC3)
 * to guarantee 100% reliable cross-platform rendering across Android, iOS,
 * Windows, and all mobile browser engines without font fallback defects.
 */

import React from 'react';

export function RiskMark({ level, className = "w-3 h-3 inline-block shrink-0" }) {
  const normLevel = (level || '').toUpperCase();

  switch (normLevel) {
    case 'SAFE':
      return (
        <svg viewBox="0 0 12 12" className={className} fill="currentColor" aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" />
        </svg>
      );

    case 'CAUTION':
      return (
        <svg viewBox="0 0 12 12" className={className} fill="currentColor" aria-hidden="true">
          <polygon points="6,1.5 10.5,6 6,10.5 1.5,6" />
        </svg>
      );

    case 'UNSAFE':
      return (
        <svg viewBox="0 0 12 12" className={className} fill="currentColor" aria-hidden="true">
          <polygon points="6,1.5 11,10 1,10" />
        </svg>
      );

    case 'DANGEROUS':
      return (
        <svg viewBox="0 0 12 12" className={className} fill="currentColor" aria-hidden="true">
          <polygon points="4,1.5 8,1.5 10.5,4 10.5,8 8,10.5 4,10.5 1.5,8 1.5,4" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="6" cy="6" r="4" strokeDasharray="2 2" />
        </svg>
      );
  }
}

export default function RiskIndicator({ level, score, showScore = true, label, className = "" }) {
  const normLevel = (level || 'UNRATED').toUpperCase();
  const hasScore = score !== null && score !== undefined;

  let badgeColor = 'bg-slate-800/40 text-[var(--text-secondary)] border-[var(--border-base)]';
  if (normLevel === 'DANGEROUS' || (hasScore && score > 80)) {
    badgeColor = 'bg-rose-500/20 text-[var(--dangerous-bright)] border-rose-500/40';
  } else if (normLevel === 'UNSAFE' || (hasScore && score > 50)) {
    badgeColor = 'bg-orange-500/20 text-orange-400 border-orange-500/40';
  } else if (normLevel === 'CAUTION' || (hasScore && score > 30)) {
    badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
  } else if (normLevel === 'SAFE') {
    badgeColor = 'bg-emerald-500/20 text-[var(--safe-bright)] border-emerald-500/40';
  }

  const displayText = label || (hasScore ? `${Math.round(score)}/100` : 'Unrated');

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center space-x-1.5 ${badgeColor} ${className}`}>
      <RiskMark level={normLevel} className="w-2.5 h-2.5" />
      <span>{displayText}</span>
    </span>
  );
}
