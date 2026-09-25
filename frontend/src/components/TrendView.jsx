/**
 * ============================================================================
 * ORCA Statistical Trend Visualizer & SVG Timeseries (src/components/TrendView.jsx)
 * ============================================================================
 * Visualizes historical ocean climate trends and anomaly charts.
 * 
 * Capabilities (Architecture Spec §72):
 * 1. Trend Badging: Direction indicator (increasing, decreasing, stable, insufficient_data).
 * 2. Pure SVG Timeseries Line Chart: Zero-dependency responsive SVG graph of monthly means.
 * 3. Anomaly Analysis: Flags historical marine heatwaves or extreme anomaly months.
 * 4. Transparent Proxy Reporting: Alerts if chlorophyll was proxied by sea surface temperature.
 * 5. Data Quality Provenance: Displays temporal completeness and baseline sample size.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  HelpCircle, 
  AlertTriangle, 
  Calendar, 
  Info, 
  ShieldCheck, 
  Database,
  Activity,
  Layers
} from 'lucide-react';

/**
 * Historical Trend Results View Component.
 * 
 * @param {Object} props
 * @param {Object|null} props.trendResult - Complete trend result contract object from /api/v1/trend.
 */
export default function TrendView({ trendResult }) {
  const { t } = useTranslation('ui');

  if (!trendResult) {
    return (
      <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-3xl text-center text-[var(--text-secondary)]">
        <Info className="w-8 h-8 text-[var(--accent-primary)] mx-auto mb-2" />
        <p className="text-sm font-semibold">{t('trend.noTrendResults')}</p>
      </div>
    );
  }

  const {
    parameter = 'ocean_parameter',
    location = {},
    period = {},
    monthly_means = [],
    anomalies = [],
    trend_direction = 'insufficient_data',
    trend_magnitude = null,
    unusual_events = [],
    unobserved_factors = [],
    explanation = null,
    confidence = null,
    data_quality = null,
  } = trendResult;

  const locName = location.original?.name || 
    (location.original?.lat ? `${location.original.lat.toFixed(2)}°N, ${location.original.lon.toFixed(2)}°E` : t('trend.selectedSector'));

  // Check if chlorophyll fallback to SST was mentioned
  const isChlorophyllProxy = Boolean(
    explanation && (
      explanation.toLowerCase().includes('chlorophyll was unavailable') ||
      explanation.toLowerCase().includes('sst was used as a proxy') ||
      explanation.toLowerCase().includes('used as proxy')
    )
  );

  // Direction badge
  const getDirectionBadge = (dir) => {
    switch (dir) {
      case 'increasing':
        return { label: t('trend.dirIncreasing'), bg: 'bg-rose-950/70 text-[var(--dangerous-bright)] border-[var(--dangerous)]', icon: TrendingUp };
      case 'decreasing':
        return { label: t('trend.dirDecreasing'), bg: 'bg-blue-950/70 text-blue-300 border-blue-800', icon: TrendingDown };
      case 'stable':
        return { label: t('trend.dirStable'), bg: 'bg-emerald-950/70 text-[var(--safe-bright)] border-[var(--safe)]', icon: Minus };
      default:
        return { label: t('trend.dirInsufficient'), bg: 'bg-[var(--bg-surface-2)] text-[var(--text-secondary)] border-[var(--border-base)]', icon: HelpCircle };
    }
  };

  const badge = getDirectionBadge(trend_direction);
  const DirectionIcon = badge.icon;

  // SVG Line Chart calculation for monthly_means
  const chartHeight = 160;
  const chartWidth = 560;
  const padding = 36;

  const validMeans = monthly_means.filter((m) => m && typeof m.value === 'number' && !isNaN(m.value));
  let pointsStr = '';
  let minVal = 0;
  let maxVal = 1;
  let unit = validMeans[0]?.unit || '';

  if (validMeans.length > 0) {
    const vals = validMeans.map((m) => m.value);
    minVal = Math.min(...vals);
    maxVal = Math.max(...vals);
    if (minVal === maxVal) {
      minVal -= 1;
      maxVal += 1;
    }
    const valRange = maxVal - minVal;

    const coords = validMeans.map((m, idx) => {
      const x = padding + (idx / Math.max(1, validMeans.length - 1)) * (chartWidth - 2 * padding);
      const y = chartHeight - padding - ((m.value - minVal) / valRange) * (chartHeight - 2 * padding);
      return { x, y, month: m.month, val: m.value };
    });

    pointsStr = coords.map((c) => `${c.x},${c.y}`).join(' ');
  }

  return (
    <div className="space-y-6">
      
      {/* Proxy Warning Notice */}
      {isChlorophyllProxy && (
        <div className="p-4 rounded-2xl bg-amber-950/60 border border-[var(--caution)] text-amber-200 flex items-start space-x-3 text-xs sm:text-sm shadow-lg">
          <AlertTriangle className="w-5 h-5 text-[var(--caution-bright)] flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">{t('trend.proxyNoticeTitle')}: </span>
            <span>{t('trend.proxyNoticeDesc')}</span>
          </div>
        </div>
      )}

      {/* Main Metric Hero Card */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-3xl p-6 sm:p-7 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-[var(--accent-primary)]" />
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] capitalize">
                {parameter.replace(/_/g, ' ')} {t('trend.multiYearAnalysisTitle')}
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
              {t('trend.sector')}: <b className="text-[var(--text-primary)]">{locName}</b>
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider ${badge.bg}`}>
              <DirectionIcon className="w-4 h-4" />
              <span>{badge.label}</span>
            </span>
          </div>
        </div>

        {/* Magnitude and Confidence Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-base)]">
            <div className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('trend.magnitudeLabel')}</div>
            <div className="text-xl sm:text-2xl font-black text-[var(--text-primary)] mt-1">
              {trend_magnitude !== null && trend_magnitude !== undefined 
                ? `${trend_magnitude > 0 ? '+' : ''}${trend_magnitude.toFixed(2)} ${unit}/year`
                : t('pointDetail.unavailable')
              }
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-base)]">
            <div className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('trend.confidenceLabel')}</div>
            <div className="text-xl sm:text-2xl font-black text-[var(--accent-primary)] mt-1">
              {confidence !== null && confidence !== undefined 
                ? `${Math.round(confidence * 100)}%`
                : t('pointDetail.unavailable')
              }
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-base)]">
            <div className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('trend.comparisonPeriods')}</div>
            <div className="text-xs text-[var(--text-secondary)] font-mono mt-1 space-y-0.5">
              <div>Base: {period?.baseline_start || '—'} to {period?.baseline_end || '—'}</div>
              <div>Eval: {period?.analysis_start || '—'} to {period?.analysis_end || '—'}</div>
            </div>
          </div>
        </div>

        {/* SVG Time Series Chart */}
        {validMeans.length > 1 ? (
          <div className="mt-4 p-4 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-base)] overflow-x-auto">
            <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>{t('trend.monthlyMeansChartTitle')}</span>
              <span className="text-[11px] font-mono text-[var(--accent-primary)]">{unit}</span>
            </div>
            
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-44">
              {/* Axes */}
              <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#334155" strokeWidth="1" />
              <line x1={padding} y1={padding} x2={padding} y2={chartHeight - padding} stroke="#334155" strokeWidth="1" />

              {/* Shaded baseline zone */}
              <rect
                x={padding}
                y={padding}
                width={chartWidth - 2 * padding}
                height={chartHeight - 2 * padding}
                fill="url(#anomGrad)"
                opacity="0.12"
              />

              <defs>
                <linearGradient id="anomGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>

              {/* Polyline */}
              <polyline
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsStr}
              />

              {/* Data points */}
              {validMeans.map((m, i) => {
                const x = padding + (i / (validMeans.length - 1)) * (chartWidth - 2 * padding);
                const y = chartHeight - padding - ((m.value - minVal) / (maxVal - minVal || 1)) * (chartHeight - 2 * padding);
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r="3.5" fill="#06b6d4" stroke="#0f172a" strokeWidth="1.5" />
                    {i % Math.ceil(validMeans.length / 6) === 0 && (
                      <text x={x} y={chartHeight - 12} fontSize="9" fill="#94a3b8" textAnchor="middle" fontFamily="monospace">
                        {m.month.slice(2)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-[var(--text-muted)] font-mono">
            {t('trend.singleObservationNote')}
          </div>
        )}

        {/* Explanation Text */}
        {explanation && (
          <div className="p-4 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-base)] text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed space-y-2">
            <div className="text-[11px] font-bold text-[var(--accent-primary)] uppercase tracking-wider flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>{t('trend.historicalExplanation')}</span>
            </div>
            <p>{explanation}</p>
          </div>
        )}
      </div>

      {/* Unusual Events & Unobserved Factors (The Honesty Section) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Unusual Events */}
        <div className="p-5 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-base)] shadow-xl space-y-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[var(--caution-bright)]" />
            <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              {t('trend.unusualEventsTitle')}
            </h4>
          </div>

          {unusual_events && unusual_events.length > 0 ? (
            <div className="space-y-2">
              {unusual_events.map((ev, i) => (
                <div key={i} className="p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-base)] text-xs space-y-1">
                  <div className="flex items-center justify-between text-[var(--caution-bright)] font-bold">
                    <span>{ev.event_type.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-[10px] text-[var(--text-secondary)]">{ev.period_start} to {ev.period_end}</span>
                  </div>
                  {ev.description && <p className="text-[var(--text-secondary)]">{ev.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">{t('trend.noUnusualEvents')}</p>
          )}
        </div>

        {/* Unobserved Factors — Mandatory Honesty Section §72.2 */}
        <div className="p-5 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-base)] shadow-xl space-y-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
            <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              {t('trend.unobservedFactorsTitle')}
            </h4>
          </div>

          <p className="text-[11px] text-[var(--text-secondary)]">
            {t('trend.unobservedFactorsSubtitle')}
          </p>

          <div className="space-y-1.5">
            {(unobserved_factors && unobserved_factors.length > 0 ? unobserved_factors : [
              t('trend.unobservedFactor1'),
              t('trend.unobservedFactor2'),
              t('trend.unobservedFactor3'),
              t('trend.unobservedFactor4'),
            ]).map((factor, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-base)] text-xs text-[var(--text-secondary)] flex items-start space-x-2">
                <span className="text-[var(--accent-primary)] font-bold">•</span>
                <span>{factor}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Telemetry Provenance */}
      {data_quality && (
        <div className="p-4 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-base)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-[var(--text-muted)]" />
            <span>{t('trend.dataProvenance')}: {data_quality.source_note || 'Copernicus Marine & Open-Meteo Historical Archive'}</span>
          </div>
          <span className="font-mono text-[11px] text-[var(--text-muted)]">{t('trend.freshness')}: {data_quality.freshness || 'Archived'}</span>
        </div>
      )}

    </div>
  );
}
