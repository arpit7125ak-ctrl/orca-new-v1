
import React, { useState } from 'react';
import { Compass, Waves, Wind, MapPin, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import RiskIndicator from './RiskIndicator';

// --------------------------------------------------------------------------
// PointCard - extracted for local expanded state
// --------------------------------------------------------------------------
function PointCard({ pt, id, info, labelText, hasScore, score, isSelected, barBg, validLat, validLon, onSelect, forceExpand }) {
  const { t } = useTranslation('ui');
  const [expanded, setExpanded] = useState(false);
  React.useEffect(() => { setExpanded(forceExpand || false); }, [forceExpand]);

  // Fallbacks if not provided
  const lat = typeof pt.lat === 'number' ? pt.lat.toFixed(4) : (validLat !== null ? validLat.toFixed(4) : '—');
  const lon = typeof pt.lon === 'number' ? pt.lon.toFixed(4) : (validLon !== null ? validLon.toFixed(4) : '—');

  return (
    <div 
      className={`flex flex-col min-w-0 w-full box-border overflow-hidden p-3 sm:p-4 rounded-xl cursor-pointer transition-all duration-300 interactive-card ${
        isSelected 
          ? 'bg-[var(--bg-surface-2)] border-[var(--accent-primary)] ring-1 ring-[var(--accent-glow)]' 
          : 'bg-[var(--bg-base)] border-[var(--border-base)] hover:border-slate-700 hover:bg-slate-900/60'
      }`}
    >
      <div className="flex justify-between items-start mb-2" onClick={() => onSelect(pt.rawPoint || pt)}>
        <div className="flex items-center space-x-2">
          <span className="text-sm sm:text-base">{info.compass}</span>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-[var(--text-primary)]">{id}</span>
              <span className="text-[10px] text-[var(--text-secondary)]">({labelText})</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 shrink-0">
          {pt.isPreferred && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent-primary)] border border-[var(--accent-primary)]">
              {t('grid.best', { defaultValue: 'BEST' })}
            </span>
          )}
          {pt.isWorst && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--dangerous)]/20 text-[var(--dangerous-bright)] border border-[var(--dangerous)]">
              {t('grid.worst', { defaultValue: 'WORST' })}
            </span>
          )}
          <RiskIndicator 
            level={pt.status} 
            score={pt.risk_score} 
            showScore={hasScore}
          />
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition p-0.5 rounded"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="w-full h-1.5 bg-[var(--bg-surface-2)] rounded-full overflow-hidden mb-3">
        {hasScore ? (
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${score}%`, backgroundColor: barBg }} />
        ) : (
          <div className="h-full bg-slate-700/50 w-full" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[var(--text-secondary)] mb-2">
        <div className="truncate">Lat: {lat}°N</div>
        <div className="truncate">Lon: {lon}°E</div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="min-w-0 overflow-hidden flex flex-col items-start bg-cyan-950/20 p-1.5 rounded border border-cyan-900/40">
           <span className="text-[8px] uppercase text-cyan-500/70 mb-0.5 flex items-center space-x-1"><Waves className="w-2.5 h-2.5"/><span>Wave</span></span>
           <span className="text-[10px] font-bold text-cyan-400 truncate w-full">{pt.waveVal || '—'}</span>
        </div>
        <div className="min-w-0 overflow-hidden flex flex-col items-start bg-sky-950/20 p-1.5 rounded border border-sky-900/40">
           <span className="text-[8px] uppercase text-sky-500/70 mb-0.5 flex items-center space-x-1"><Wind className="w-2.5 h-2.5"/><span>Wind</span></span>
           <span className="text-[10px] font-bold text-sky-400 truncate w-full">{pt.windVal || '—'}</span>
        </div>
      </div>

      {expanded && pt.official_warning && (
        <div className="text-[10px] font-bold text-[var(--dangerous-bright)] bg-[var(--dangerous)]/10 p-1.5 rounded border border-[var(--dangerous)]/30 mb-2 truncate">
          ⚠️ {pt.official_warning.issuing_authority} {pt.official_warning.floor_level || 'Alert'}
        </div>
      )}

      <div className={`text-[10px] text-[var(--text-secondary)] mt-1 border-t border-[var(--border-base)] pt-2 ${expanded ? '' : 'line-clamp-2'}`}>
        {pt.finding || t('grid.noneReported', { defaultValue: 'None reported' })}
      </div>
    </div>
  );
}


export default function PointGrid({ analysis, selectedPoint, onSelectPoint }) {
  const { t } = useTranslation('ui');
  const plan = analysis?.plan || {};
  
  const validLat = plan.location?.validated?.lat != null ? Number(plan.location.validated.lat) : Number(plan.location?.original?.lat);
  const validLon = plan.location?.validated?.lon != null ? Number(plan.location.validated.lon) : Number(plan.location?.original?.lon);
  
  const rawPoints = analysis?.points || [];

  const dirMap = {
    'P0': { labelKey: 'grid.dirP0', compass: '⊙' },
    'P1': { labelKey: 'grid.dirP1', compass: '↑' },
    'P2': { labelKey: 'grid.dirP2', compass: '↗' },
    'P3': { labelKey: 'grid.dirP3', compass: '→' },
    'P4': { labelKey: 'grid.dirP4', compass: '↘' },
    'P5': { labelKey: 'grid.dirP5', compass: '↓' },
    'P6': { labelKey: 'grid.dirP6', compass: '↙' },
    'P7': { labelKey: 'grid.dirP7', compass: '←' },
    'P8': { labelKey: 'grid.dirP8', compass: '↖' }
  };

  const pointsData = rawPoints.map((p, idx) => {
    const pRisk = p.risk || {};
    const factors = Array.isArray(pRisk.risk_factors) ? pRisk.risk_factors : [];
    const formattedFactors = factors.map((f) => String(f).replace(/_/g, ' ')).join(', ');
    const finding = (Array.isArray(pRisk.key_findings) ? pRisk.key_findings[0] : null) || pRisk.reasoning || t('grid.noneReported', { defaultValue: 'None reported' });
    const isPreferred = analysis?.decision?.preferred_point === (p.point_id || `P${idx}`);
    const isWorst = analysis?.decision?.worst_point === (p.point_id || `P${idx}`);

    const meas = p.measurements || {};
    const waveVal = meas.wave_height_m?.value != null ? `${meas.wave_height_m.value} m` : null;
    const windVal = meas.wind_speed_ms?.value != null ? `${meas.wind_speed_ms.value} m/s` : null;
    const waveRaw = meas.wave_height_m?.value != null ? Number(meas.wave_height_m.value) : 0;
    const windRaw = meas.wind_speed_ms?.value != null ? Number(meas.wind_speed_ms.value) : 0;
    const visRaw = meas.visibility_km?.value != null ? Number(meas.visibility_km.value) : 100;

    return {
      point_id: p.point_id || `P${idx}`,
      lat: p.lat,
      lon: p.lon,
      risk_score: pRisk.final_score ?? null,
      status: pRisk.risk_level || 'UNRATED',
      dominant_hazard: formattedFactors || t('grid.noneReported', { defaultValue: 'None reported' }),
      finding,
      isPreferred,
      isWorst,
      official_warning: pRisk.official_warnings?.[0] || null,
      point_status: p.point_status || null,
      waveVal,
      windVal,
      waveRaw,
      windRaw,
      visRaw,
      rawPoint: p,
      risk: pRisk,
      measurements: meas,
    };
  });

  const [sortMode, setSortMode] = useState('default');
  const [filterMode, setFilterMode] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [gridExpanded, setGridExpanded] = useState(true);
  const [allExpanded, setAllExpanded] = useState(false);

  const pointsSorted = [...pointsData].sort((a, b) => {
    if (sortMode === 'risk') return (b.risk_score || 0) - (a.risk_score || 0);
    if (sortMode === 'wave') return b.waveRaw - a.waveRaw;
    if (sortMode === 'wind') return b.windRaw - a.windRaw;
    if (sortMode === 'visibility') return a.visRaw - b.visRaw; // lower is worse for visibility
    return 0; // default order
  });

  const points = pointsSorted.filter(p => {
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const searchableText = `${p.point_id} ${p.status} ${p.dominant_hazard} ${p.finding} ${p.waveVal} ${p.windVal} ${p.lat} ${p.lon}`.toLowerCase();
      if (!searchableText.includes(q)) return false;
    }

    if (filterMode === 'all') return true;
    const r = p.risk_score || 0;
    if (filterMode === 'safe') return r < 35;
    if (filterMode === 'caution') return r >= 35 && r < 50;
    if (filterMode === 'high') return r >= 70 && r < 85;
    if (filterMode === 'danger') return r >= 85;
    return true;
  });

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-4 sm:p-6 shadow-sm w-full box-border">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-5 gap-4">
        <div>
          <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => setGridExpanded(!gridExpanded)}>
            <h3 className="text-sm sm:text-base font-black text-[var(--text-primary)] flex items-center space-x-2">
              <Compass className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>{t('grid.title', { defaultValue: '9-POINT SPATIAL GRID' })}</span>
            </h3>
            <button onClick={(e) => { e.stopPropagation(); setAllExpanded(!allExpanded); }} className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-white mr-3 px-2 py-1 rounded bg-[var(--bg-base)] border border-[var(--border-base)] hidden sm:block">{allExpanded ? 'Collapse All' : 'Expand All'}</button><button aria-expanded={gridExpanded} className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] group-hover:text-white transition rounded">
              {gridExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            {t('grid.subtitle', { defaultValue: 'Localized conditions around your coordinate.' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-base)] rounded-lg px-2.5 py-1.5 text-[10px] uppercase tracking-wider outline-none placeholder:text-white/20 w-28 focus:border-[var(--accent-primary)] transition"
          />
          <select 
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border-base)] rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer hover:border-white/20 transition"
          >
             <option value="all">All</option>
             <option value="safe">Safe</option>
             <option value="caution">Caution</option>
             <option value="high">High</option>
             <option value="danger">Danger</option>
          </select>
          <select 
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border-base)] rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer hover:border-white/20 transition"
          >
             <option value="default">Default</option>
             <option value="risk">Risk</option>
             <option value="wave">Wave</option>
             <option value="wind">Wind</option>
             <option value="visibility">Vis</option>
          </select>
        </div>
      </div>

      {gridExpanded && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px] w-full box-border animate-in fade-in slide-in-from-top-2 duration-300">
        {points.map((pt) => {
          const id = pt.point_id || 'P0';
          const info = dirMap[id] || { labelKey: null, compass: '📍' };
          const labelText = info.labelKey ? t(info.labelKey) : id;
          const hasScore = pt.risk_score !== null && pt.risk_score !== undefined;
          const score = hasScore ? Math.round(pt.risk_score) : null;
          const isSelected = selectedPoint?.point_id === id || selectedPoint?.id === id;

          let barBg = 'var(--text-secondary)';
          if (pt.status === 'DANGEROUS') {
            barBg = 'var(--dangerous-text)';
          } else if (pt.status === 'UNSAFE') {
            barBg = 'var(--unsafe-text)';
          } else if (pt.status === 'CAUTION') {
            barBg = 'var(--caution-text)';
          } else if (pt.status === 'SAFE') {
            barBg = 'var(--safe-text)';
          }

          return (
            <PointCard forceExpand={allExpanded} 
              key={id}
              pt={pt}
              id={id}
              info={info}
              labelText={labelText}
              hasScore={hasScore}
              score={score}
              isSelected={isSelected}
              barBg={barBg}
              validLat={validLat}
              validLon={validLon}
              onSelect={onSelectPoint}
            />
          );
        })}
      </div>
      )}
    </div>
  );
}
