/**
 * ============================================================================
 * ORCA Multi-Point Safety Matrix (src/components/PointGrid.jsx)
 * ============================================================================
 * Visual matrix of all geographical sampling points evaluated by the pipeline.
 * 
 * Capabilities (Architecture Spec §7, §8):
 * 1. 9-Point Local Grid & 25-Point Regional Grid: Displays center anchor (P0) and
 *    surrounding cardinal/intercardinal perimeter stations (P1-P8 / R0001-R0008).
 * 2. Visual Badging: Highlights the algorithmically preferred point (green ring)
 *    and highest risk/worst point (red ring).
 * 3. Quick Telemetry Snippets: Significant wave height (Hs), wind velocity, and dominant hazards.
 * 4. Interactive Selection: Clicking any point card opens the comprehensive 26-parameter
 *    PointDetailSheet inspection drawer.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, Waves, Wind, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';

/**
 * Multi-Point Grid Matrix Component.
 * 
 * @param {Object} props
 * @param {Object|null} props.analysis - Completed analysis result object.
 * @param {Object|null} props.selectedPoint - Currently selected point for deep inspection.
 * @param {Function} props.onSelectPoint - Callback triggered when user clicks a point card.
 */
export default function PointGrid({ analysis, selectedPoint, onSelectPoint }) {
  const { t } = useTranslation('ui');
  const plan = analysis?.plan || {};
  const rawPoints = analysis?.points || [];

  const validLat = plan.location?.validated?.lat ?? plan.location?.original?.lat ?? (rawPoints[0] ? rawPoints[0].lat : null);
  const validLon = plan.location?.validated?.lon ?? plan.location?.original?.lon ?? (rawPoints[0] ? rawPoints[0].lon : null);

  const dirMap = {
    P0: { labelKey: 'grid.dirP0', compass: '🎯' },
    P1: { labelKey: 'grid.dirP1', compass: '⬆️' },
    P2: { labelKey: 'grid.dirP2', compass: '↗️' },
    P3: { labelKey: 'grid.dirP3', compass: '➡️' },
    P4: { labelKey: 'grid.dirP4', compass: '↘️' },
    P5: { labelKey: 'grid.dirP5', compass: '⬇️' },
    P6: { labelKey: 'grid.dirP6', compass: '↙️' },
    P7: { labelKey: 'grid.dirP7', compass: '⬅️' },
    P8: { labelKey: 'grid.dirP8', compass: '↖️' },
  };

  if (rawPoints.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center text-slate-400">
        <Compass className="w-8 h-8 text-cyan-400 mx-auto mb-2 animate-spin-slow" />
        <p className="text-sm font-semibold">{t('grid.noMatrixLoaded')}</p>
        <p className="text-xs text-slate-500 mt-1">{t('grid.submitQueryHint')}</p>
      </div>
    );
  }

  const points = rawPoints.map((p, idx) => {
    const pRisk = p.risk || {};
    const factors = Array.isArray(pRisk.risk_factors) ? pRisk.risk_factors : [];
    const formattedFactors = factors.map((f) => String(f).replace(/_/g, ' ')).join(', ');
    const finding = (Array.isArray(pRisk.key_findings) ? pRisk.key_findings[0] : null) || pRisk.reasoning || t('results.evaluated');
    const isPreferred = analysis?.decision?.preferred_point === (p.point_id || `P${idx}`);
    const isWorst = analysis?.decision?.worst_point === (p.point_id || `P${idx}`);

    const meas = p.measurements || {};
    const waveVal = meas.wave_height_m?.value != null ? `${meas.wave_height_m.value}m` : null;
    const windVal = meas.wind_speed_ms?.value != null ? `${meas.wind_speed_ms.value}m/s` : null;

    return {
      point_id: p.point_id || `P${idx}`,
      lat: p.lat,
      lon: p.lon,
      risk_score: pRisk.final_score ?? null,
      status: pRisk.risk_level || 'UNRATED',
      dominant_hazard: formattedFactors || t('grid.noneReported'),
      finding,
      isPreferred,
      isWorst,
      official_warning: pRisk.official_warnings?.[0] || null,
      point_status: p.point_status || null,
      waveVal,
      windVal,
      rawPoint: p,
    };
  });

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center space-x-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>{t('grid.title')}</span>
          </h3>
          <p className="text-xs text-slate-400">
            {t('grid.subtitle')}
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded-lg border border-cyan-800">
          {t('grid.evaluatedCount', { count: points.length })}
        </span>
      </div>

      {/* 3x3 Responsive Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {points.map((pt) => {
          const id = pt.point_id || 'P0';
          const info = dirMap[id] || { labelKey: null, compass: '📍' };
          const labelText = info.labelKey ? t(info.labelKey) : id;
          const hasScore = pt.risk_score !== null && pt.risk_score !== undefined;
          const score = hasScore ? Math.round(pt.risk_score) : null;
          const isSelected = selectedPoint?.point_id === id || selectedPoint?.id === id;

          // Color scale
          let badgeColor = 'bg-slate-800/40 text-slate-400 border-slate-700';
          let barColor = 'bg-slate-700';
          if (hasScore) {
            if (score > 80 || pt.status === 'DANGEROUS') {
              badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/40';
              barColor = 'bg-rose-500';
            } else if (score > 60 || pt.status === 'UNSAFE') {
              badgeColor = 'bg-orange-500/20 text-orange-400 border-orange-500/40';
              barColor = 'bg-orange-500';
            } else if (score > 30 || pt.status === 'CAUTION') {
              badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
              barColor = 'bg-amber-400';
            } else {
              badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
              barColor = 'bg-emerald-500';
            }
          }

          return (
            <div
              key={id}
              onClick={() => onSelectPoint && onSelectPoint(pt.rawPoint || pt)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-cyan-950/40 border-cyan-500 ring-2 ring-cyan-500/40 shadow-lg'
                  : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-base">{info.compass}</span>
                  <div>
                    <span className="text-xs font-bold text-white">{id}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">({labelText})</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  {pt.isPreferred && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {t('grid.best')}
                    </span>
                  )}
                  {pt.isWorst && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                      {t('grid.worst')}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                    {hasScore ? `${score}/100` : t('grid.unrated')}
                  </span>
                </div>
              </div>

              {/* Score bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                {hasScore ? (
                  <div className={`h-full ${barColor} rounded-full`} style={{ width: `${score}%` }} />
                ) : (
                  <div className="h-full bg-slate-700/50 w-full" />
                )}
              </div>

              {/* Coordinates and Hazard Factors */}
              <div className="text-[11px] text-slate-300 space-y-1">
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>{t('map.latLabel')}: {typeof pt.lat === 'number' ? pt.lat.toFixed(3) : (validLat !== null ? validLat.toFixed(3) : '—')}°N</span>
                  <span>{t('map.lonLabel')}: {typeof pt.lon === 'number' ? pt.lon.toFixed(3) : (validLon !== null ? validLon.toFixed(3) : '—')}°E</span>
                </div>

                {/* Key quick telemetry tags */}
                {(pt.waveVal || pt.windVal) && (
                  <div className="flex items-center space-x-2 text-[10px] py-0.5 font-mono">
                    {pt.waveVal && (
                      <span className="text-cyan-300 bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/60">
                        🌊 {pt.waveVal}
                      </span>
                    )}
                    {pt.windVal && (
                      <span className="text-sky-300 bg-sky-950/50 px-1.5 py-0.5 rounded border border-sky-800/60">
                        💨 {pt.windVal}
                      </span>
                    )}
                  </div>
                )}

                {pt.official_warning && (
                  <div className="text-[10px] font-bold text-rose-400 truncate">
                    ⚠️ {pt.official_warning.issuing_authority} {pt.official_warning.floor_level || 'Alert'}
                  </div>
                )}

                <div className="text-[10px] text-slate-400 line-clamp-2 pt-1 border-t border-slate-800/60">
                  {pt.finding}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
