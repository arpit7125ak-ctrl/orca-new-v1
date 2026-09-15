import React from 'react';
import { Compass, Waves, Wind, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function PointGrid({ analysis, selectedPoint, onSelectPoint }) {
  const plan = analysis?.plan || {};
  const validLat = plan.location?.validated?.lat || plan.location?.original?.lat || 9.94;
  const validLon = plan.location?.validated?.lon || plan.location?.original?.lon || 76.16;

  const dirMap = {
    P0: { label: 'Center (Origin)', compass: '🎯' },
    P1: { label: 'North', compass: '⬆️' },
    P2: { label: 'Northeast', compass: '↗️' },
    P3: { label: 'East', compass: '➡️' },
    P4: { label: 'Southeast', compass: '↘️' },
    P5: { label: 'South', compass: '⬇️' },
    P6: { label: 'Southwest', compass: '↙️' },
    P7: { label: 'West', compass: '⬅️' },
    P8: { label: 'Northwest', compass: '↖️' },
  };

  const rawPoints = analysis?.points || [];

  if (rawPoints.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center text-slate-400">
        <Compass className="w-8 h-8 text-cyan-400 mx-auto mb-2 animate-spin-slow" />
        <p className="text-sm font-semibold">No active 9-point spatial matrix loaded.</p>
        <p className="text-xs text-slate-500 mt-1">Submit an operational query to screen surrounding quadrants.</p>
      </div>
    );
  }

  const points = rawPoints.map((p, idx) => {
    const pRisk = p.risk || {};
    const factors = Array.isArray(pRisk.risk_factors) ? pRisk.risk_factors : [];
    const formattedFactors = factors.map((f) => String(f).replace(/_/g, ' ')).join(', ');
    const finding = (Array.isArray(pRisk.key_findings) ? pRisk.key_findings[0] : null) || pRisk.reasoning || 'Sea state evaluated';
    const isPreferred = analysis?.decision?.preferred_point === (p.point_id || `P${idx}`);
    const isWorst = analysis?.decision?.worst_point === (p.point_id || `P${idx}`);

    return {
      point_id: p.point_id || `P${idx}`,
      lat: p.lat,
      lon: p.lon,
      risk_score: pRisk.final_score ?? 30,
      status: pRisk.risk_level || 'SAFE',
      dominant_hazard: formattedFactors || 'Normal Sea',
      finding,
      isPreferred,
      isWorst,
      official_warning: pRisk.official_warnings?.[0] || null,
    };
  });

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center space-x-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>9-Point Spatial Grid Assessment Matrix</span>
          </h3>
          <p className="text-xs text-slate-400">
            Real sensor-backed safety screening across all 9 marine quadrants
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded-lg border border-cyan-800">
          {points.length} / 9 Evaluated
        </span>
      </div>

      {/* 3x3 Responsive Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {points.map((pt) => {
          const id = pt.point_id || 'P0';
          const info = dirMap[id] || { label: id, compass: '📍' };
          const score = Math.round(pt.risk_score ?? 30);
          const isSelected = selectedPoint?.point_id === id || selectedPoint?.id === id;

          // Color scale
          let badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
          let barColor = 'bg-emerald-500';
          if (score > 80 || pt.status === 'DANGEROUS') {
            badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/40';
            barColor = 'bg-rose-500';
          } else if (score > 60 || pt.status === 'UNSAFE') {
            badgeColor = 'bg-orange-500/20 text-orange-400 border-orange-500/40';
            barColor = 'bg-orange-500';
          } else if (score > 30 || pt.status === 'CAUTION') {
            badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
            barColor = 'bg-amber-400';
          }

          return (
            <div
              key={id}
              onClick={() => onSelectPoint && onSelectPoint(pt)}
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
                    <span className="text-[10px] text-slate-400 ml-1.5">({info.label})</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  {pt.isPreferred && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      Best
                    </span>
                  )}
                  {pt.isWorst && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                      Worst
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                    {score}/100
                  </span>
                </div>
              </div>

              {/* Score bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                <div className={`h-full ${barColor} rounded-full`} style={{ width: `${score}%` }} />
              </div>

              {/* Coordinates and Hazard Factors */}
              <div className="text-[11px] text-slate-300 space-y-1">
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>Lat: {typeof pt.lat === 'number' ? pt.lat.toFixed(3) : validLat.toFixed(3)}°N</span>
                  <span>Lon: {typeof pt.lon === 'number' ? pt.lon.toFixed(3) : validLon.toFixed(3)}°E</span>
                </div>

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
