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
  const normLevel = (level || '').toUpperCase();
  const hasScore = score !== null && score !== undefined && !isNaN(score);
  const isKnownLevel = ['SAFE', 'CAUTION', 'UNSAFE', 'DANGEROUS'].includes(normLevel);

  // Defensive warning: upstream data gap where a numeric score exists but level is missing/unrated
  if (!isKnownLevel && hasScore) {
    console.warn(
      `[RiskIndicator] Upstream data gap: numeric risk score (${score}) present, but risk level is missing or unrated ("${level}").`
    );
  }

  // 1. Badge style selection depends on level ONLY (Single Source of Truth)
  let badgeStyle = {
    color: 'var(--text-secondary)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'var(--border-base)',
  };

  if (normLevel === 'DANGEROUS') {
    badgeStyle = {
      color: 'var(--dangerous-text)',
      backgroundColor: 'var(--dangerous-bg)',
      borderColor: 'var(--dangerous-border)',
    };
  } else if (normLevel === 'UNSAFE') {
    badgeStyle = {
      color: 'var(--unsafe-text)',
      backgroundColor: 'var(--unsafe-bg)',
      borderColor: 'var(--unsafe-border)',
    };
  } else if (normLevel === 'CAUTION') {
    badgeStyle = {
      color: 'var(--caution-text)',
      backgroundColor: 'var(--caution-bg)',
      borderColor: 'var(--caution-border)',
    };
  } else if (normLevel === 'SAFE') {
    badgeStyle = {
      color: 'var(--safe-text)',
      backgroundColor: 'var(--safe-bg)',
      borderColor: 'var(--safe-border)',
    };
  }

  // 2. Display text: Level name must always be visible; score is display-only and appended when available
  let displayText;
  if (label) {
    displayText = label;
  } else {
    const levelName = isKnownLevel ? normLevel : 'Unrated';
    if (hasScore && showScore) {
      displayText = `${levelName} · ${Math.round(score)}/100`;
    } else {
      displayText = levelName;
    }
  }

  return (
    <span 
      style={badgeStyle}
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center space-x-1.5 transition-colors ${className}`}
    >
      <RiskMark level={normLevel} className="w-2.5 h-2.5" />
      <span>{displayText}</span>
    </span>
  );
}
