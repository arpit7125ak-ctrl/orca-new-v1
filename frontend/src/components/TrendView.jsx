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

export default function TrendView({ trendResult }) {
  const { t } = useTranslation('ui');

  if (!trendResult) {
    return (
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-3xl text-center text-slate-400">
        <Info className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
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
        return { label: t('trend.dirIncreasing'), bg: 'bg-rose-950/70 text-rose-300 border-rose-800', icon: TrendingUp };
      case 'decreasing':
        return { label: t('trend.dirDecreasing'), bg: 'bg-blue-950/70 text-blue-300 border-blue-800', icon: TrendingDown };
      case 'stable':
        return { label: t('trend.dirStable'), bg: 'bg-emerald-950/70 text-emerald-300 border-emerald-800', icon: Minus };
      default:
        return { label: t('trend.dirInsufficient'), bg: 'bg-slate-800 text-slate-400 border-slate-700', icon: HelpCircle };
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
        <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-800 text-amber-200 flex items-start space-x-3 text-xs sm:text-sm shadow-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">{t('trend.proxyNoticeTitle')}: </span>
            <span>{t('trend.proxyNoticeDesc')}</span>
          </div>
        </div>
      )}

      {/* Main Metric Hero Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base sm:text-lg font-bold text-white capitalize">
                {parameter.replace(/_/g, ' ')} {t('trend.multiYearAnalysisTitle')}
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {t('trend.sector')}: <b className="text-slate-200">{locName}</b>
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
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('trend.magnitudeLabel')}</div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">
              {trend_magnitude !== null && trend_magnitude !== undefined 
                ? `${trend_magnitude > 0 ? '+' : ''}${trend_magnitude.toFixed(2)} ${unit}/year`
                : t('pointDetail.unavailable')
              }
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('trend.confidenceLabel')}</div>
            <div className="text-xl sm:text-2xl font-black text-cyan-400 mt-1">
              {confidence !== null && confidence !== undefined 
                ? `${Math.round(confidence * 100)}%`
                : t('pointDetail.unavailable')
              }
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('trend.comparisonPeriods')}</div>
            <div className="text-xs text-slate-300 font-mono mt-1 space-y-0.5">
              <div>Base: {period?.baseline_start || '—'} to {period?.baseline_end || '—'}</div>
              <div>Eval: {period?.analysis_start || '—'} to {period?.analysis_end || '—'}</div>
            </div>
          </div>
        </div>

        {/* SVG Time Series Chart */}
        {validMeans.length > 1 ? (
          <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 overflow-x-auto">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>{t('trend.monthlyMeansChartTitle')}</span>
              <span className="text-[11px] font-mono text-cyan-400">{unit}</span>
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
          <div className="text-center py-6 text-xs text-slate-500 font-mono">
            {t('trend.singleObservationNote')}
          </div>
        )}

        {/* Explanation Text */}
        {explanation && (
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed space-y-2">
            <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5">
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
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('trend.unusualEventsTitle')}
            </h4>
          </div>

          {unusual_events && unusual_events.length > 0 ? (
            <div className="space-y-2">
              {unusual_events.map((ev, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between text-amber-300 font-bold">
                    <span>{ev.event_type.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-[10px] text-slate-400">{ev.period_start} to {ev.period_end}</span>
                  </div>
                  {ev.description && <p className="text-slate-300">{ev.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">{t('trend.noUnusualEvents')}</p>
          )}
        </div>

        {/* Unobserved Factors — Mandatory Honesty Section §72.2 */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('trend.unobservedFactorsTitle')}
            </h4>
          </div>

          <p className="text-[11px] text-slate-400">
            {t('trend.unobservedFactorsSubtitle')}
          </p>

          <div className="space-y-1.5">
            {(unobserved_factors && unobserved_factors.length > 0 ? unobserved_factors : [
              t('trend.unobservedFactor1'),
              t('trend.unobservedFactor2'),
              t('trend.unobservedFactor3'),
              t('trend.unobservedFactor4'),
            ]).map((factor, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>{factor}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Telemetry Provenance */}
      {data_quality && (
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-slate-500" />
            <span>{t('trend.dataProvenance')}: {data_quality.source_note || 'Copernicus Marine & Open-Meteo Historical Archive'}</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">{t('trend.freshness')}: {data_quality.freshness || 'Archived'}</span>
        </div>
      )}

    </div>
  );
}
