/**
 * ============================================================================
 * ORCA Comprehensive Point Telemetry Inspection Sheet (src/components/PointDetailSheet.jsx)
 * ============================================================================
 * Slide-out deep inspection drawer rendering all ~26 possible environmental measurements
 * for any selected sampling point (P0, R0001-R0008).
 * 
 * Measurement Categories (7 Specialized Domains):
 * 1. Weather: Wind speed, gusts, direction (16-point compass), air temp, visibility, precipitation.
 * 2. Ocean: Significant wave height (Hs), swell height, swell period, currents, sea surface temp (SST), salinity.
 * 3. Tide: Current tide height, tidal phase, flood/ebb direction, bar-mouth hazard.
 * 4. Cyclone & Warnings: IMD warning category, distance to active storm center, squall alert.
 * 5. GIS & Navigation: Water depth/bathymetry, distance to port, inside prohibited zone, shipping lane proximity.
 * 6. PFZ (Potential Fishing Zone): INCOIS PFZ line distance, aggregation suitability score, SST gradient.
 * 7. Marine Ecosystem: Chlorophyll-a concentration, dissolved oxygen (DO), ecological sensitivity.
 * 
 * Data Quality Badging:
 * Every measurement displays its source authority (IMD, INCOIS, Copernicus), freshness status
 * ('fresh', 'stale', 'old'), and hazard highlight.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  AlertTriangle,
  Scale,
  Wind,
  Waves,
  Thermometer,
  Navigation,
  MapPin,
  Fish,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Formatters & Telemetry Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts meteorological/oceanographic azimuth degrees (0-360) into a 16-point compass label.
 * Boundaries: N (348.75-11.25), NNE (11.25-33.75), NE (33.75-56.25), ..., WNW (281.25-303.75), NW (303.75-326.25).
 * 
 * @param {number|string|null} deg - Direction in decimal degrees.
 * @returns {string} 16-point cardinal string (e.g. 'WNW', 'SW') or empty string.
 */
function degToCompass(deg) {
  if (deg === null || deg === undefined || isNaN(Number(deg))) return '';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(Number(deg) / 22.5) % 16];
}

/** Format a measurement value + unit into a display string */
function fmtValue(m) {
  if (!m) return '—';
  const v = m.value;
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'YES' : 'NO';
  const unit = m.unit ? ` ${m.unit}` : '';
  return `${v}${unit}`;
}

/** Freshness badge colour + label from freshness.state */
function freshnessProps(m) {
  const state = m?.freshness?.state;
  if (state === 'fresh')  return { cls: 'text-[var(--safe-bright)] bg-emerald-950/60 border-[var(--safe)]', label: 'fresh' };
  if (state === 'stale')  return { cls: 'text-[var(--caution-bright)]  bg-amber-950/60  border-[var(--caution)]',  label: 'stale' };
  if (state === 'old')    return { cls: 'text-[var(--dangerous-bright)]   bg-rose-950/60   border-[var(--dangerous)]',   label: 'old'   };
  return { cls: 'text-[var(--text-muted)] bg-[var(--bg-surface)] border-[var(--border-base)]', label: state || '—' };
}

/** Agent colour map */
const AGENT_COLORS = {
  weather:   'bg-sky-950/70 text-sky-300 border-sky-800',
  ocean:     'bg-blue-950/70 text-blue-300 border-blue-800',
  tide:      'bg-cyan-950/70 text-[var(--accent-primary)] border-[var(--accent-primary)]',
  cyclone:   'bg-rose-950/70 text-[var(--dangerous-bright)] border-[var(--dangerous)]',
  gis:       'bg-violet-950/70 text-violet-300 border-violet-800',
  pfz:       'bg-emerald-950/70 text-[var(--safe-bright)] border-[var(--safe)]',
  ecosystem: 'bg-teal-950/70 text-teal-300 border-teal-800',
};

// ─────────────────────────────────────────────────────────────────────────────
// Single measurement tile
// ─────────────────────────────────────────────────────────────────────────────
function MeasTile({ label, mKey, m, isHazard, extra }) {
  if (!m) return null;

  const isAvailable = ['available', 'derived', 'partial'].includes(m.status);
  const isBool      = typeof m.value === 'boolean';
  const isWindDir   = mKey === 'wind_direction_deg';
  const isPfzScore  = mKey === 'pfz_suitability_score';
  const fp          = freshnessProps(m);
  const agentCls    = AGENT_COLORS[m.reported_by] || 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-base)]';

  // Border highlight if this parameter is a risk factor
  const hazardBorder = isHazard ? 'border-amber-500/70 bg-amber-950/10' : 'border-slate-800/70';

  return (
    <div className={`p-2.5 rounded-xl border ${hazardBorder} transition-colors`}>
      {/* Top row: label + hazard icon */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide truncate pr-1" title={label}>
          {label}
        </span>
        <div className="flex items-center space-x-1 flex-shrink-0">
          {isHazard && <AlertTriangle className="w-3 h-3 text-[var(--caution-bright)]" />}
          {m.reported_by && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${agentCls}`}>
              {m.reported_by}
            </span>
          )}
        </div>
      </div>

      {/* Value */}
      {isBool ? (
        <div className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold border ${
          m.value
            ? 'bg-[var(--dangerous)]/20 text-[var(--dangerous-bright)] border-rose-700'
            : 'bg-[var(--safe)]/20 text-[var(--safe-bright)] border-[var(--safe)]'
        }`}>
          {m.value ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
          <span>{m.value ? 'ACTIVE' : 'CLEAR'}</span>
        </div>
      ) : isPfzScore ? (
        <div className="space-y-1">
          <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
            {m.value !== null && m.value !== undefined ? Number(m.value).toFixed(2) : '—'}
            <span className="text-xs text-[var(--text-secondary)] font-normal"> /1.0</span>
          </span>
          <div className="w-full h-1.5 bg-[var(--bg-surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--safe)] rounded-full"
              style={{ width: `${Math.min(100, Number(m.value || 0) * 100)}%` }}
            />
          </div>
        </div>
      ) : isWindDir ? (
        <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
          {m.value !== null && m.value !== undefined ? `${m.value}° (${degToCompass(m.value)})` : '—'}
        </span>
      ) : (
        <span className={`font-mono text-sm font-bold ${isAvailable ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
          {fmtValue(m)}
        </span>
      )}

      {extra && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">{extra}</p>}

      {/* Footer: source + freshness */}
      <div className="flex items-center justify-between mt-1.5 gap-1">
        <span
          className="text-[9px] text-[var(--text-muted)] truncate"
          title={m.source || ''}
        >
          {m.source ? m.source.split('(')[0].trim() : '—'}
        </span>
        {fp.label && fp.label !== '—' && (
          <span className={`text-[9px] font-semibold px-1 py-0.5 rounded border ${fp.cls}`}>
            {fp.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible section wrapper
// ─────────────────────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, color, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasContent = React.Children.toArray(children).some(Boolean);
  if (!hasContent) return null;

  return (
    <div className="rounded-xl border border-[var(--border-base)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-base)] hover:bg-slate-900/80 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          <span className={`text-[11px] font-bold uppercase tracking-wider ${color}`}>{title}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
      </button>
      {open && (
        <div className="p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-900/20">
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Text-only tile for string/label measurements (zone_name, target_species, etc.)
// ─────────────────────────────────────────────────────────────────────────────
function TextTile({ label, mKey, m, isHazard }) {
  if (!m || m.value === null || m.value === undefined) return null;

  const display = String(m.value).replace(/_/g, ' ');
  const isHidden = !['available', 'derived', 'partial'].includes(m.status);
  const agentCls = AGENT_COLORS[m.reported_by] || 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-base)]';
  const hazardBorder = isHazard ? 'border-amber-500/70 bg-amber-950/10' : 'border-slate-800/70';

  return (
    <div className={`p-2.5 rounded-xl border col-span-2 sm:col-span-3 ${hazardBorder}`}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{label}</span>
        {m.reported_by && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${agentCls}`}>
            {m.reported_by}
          </span>
        )}
      </div>
      <span className={`text-xs font-semibold ${isHidden ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'} capitalize`}>
        {display}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function PointDetailSheet({ point, onClose }) {
  const { t } = useTranslation('ui');
  if (!point) return null;

  const risk     = point.risk || {};
  const meas     = point.measurements || {};
  const pid      = point.point_id || 'P0';
  const isLand   = point.point_status === 'not_applicable' || point.land_sea === 'land';

  const hasScore = risk.final_score !== null && risk.final_score !== undefined;
  const score    = hasScore ? Math.round(risk.final_score) : (point.risk_score !== null && point.risk_score !== undefined ? Math.round(point.risk_score) : null);
  const level    = risk.risk_level || point.status || (isLand ? 'LAND' : 'UNRATED');

  const levelColors = {
    SAFE:      { bg: 'bg-[var(--safe)]/20', text: 'text-[var(--safe-bright)]', border: 'border-[var(--safe)]' },
    CAUTION:   { bg: 'bg-[var(--caution)]/20',   text: 'text-[var(--caution-bright)]',   border: 'border-[var(--caution)]'   },
    UNSAFE:    { bg: 'bg-[var(--unsafe)]/20',  text: 'text-[var(--unsafe-bright)]',  border: 'border-[var(--unsafe)]'  },
    DANGEROUS: { bg: 'bg-[var(--dangerous)]/20',    text: 'text-[var(--dangerous-bright)]',    border: 'border-[var(--dangerous)]'    },
    LAND:      { bg: 'bg-[var(--bg-surface-2)]',   text: 'text-[var(--text-secondary)]',   border: 'border-[var(--border-base)]'   },
    UNRATED:   { bg: 'bg-[var(--bg-base)]',   text: 'text-[var(--text-secondary)]',   border: 'border-[var(--border-base)]'   },
  };
  const color = levelColors[level] || levelColors.UNRATED;

  const rawBaseline    = risk.baseline_score ?? null;
  const baseline       = rawBaseline !== null ? Math.round(rawBaseline) : null;
  const llmAdj         = risk.llm_adjustment ?? (score !== null && baseline !== null ? score - baseline : null);
  const hardFloor      = risk.constraint_floor ?? risk.safety_floor ?? null;
  const hardRules      = risk.hard_rules_applied || [];
  const riskFactors    = Array.isArray(risk.risk_factors) ? risk.risk_factors : [];
  const isHazard       = (key) => riskFactors.includes(key);

  // helper: get measurement or null
  const M = (key) => (meas[key] && ['available', 'derived', 'partial'].includes(meas[key].status)) ? meas[key] : null;

  // Count available measurements per section for display
  const weatherKeys  = ['wind_speed_ms','wind_gust_ms','wind_direction_deg','visibility_km','precipitation_mm'];
  const metoceanKeys = ['wave_height_m','wave_period_s','swell_height_m','current_speed_ms','sst_c'];
  const tideKeys     = ['tide_height_m','tidal_current_ms'];
  const warningKeys  = ['official_warning_active','inside_prohibited_zone','zone_name','zone_category','constraint_type'];
  const geoKeys      = ['water_depth_m','distance_to_boundary_km','nearest_boundary_name'];
  const fishKeys     = ['pfz_suitability_score','sst_gradient','distance_to_pfz_km','target_species','chlorophyll_mg_m3','dissolved_oxygen_mmol_m3'];

  const totalAvailable = [...weatherKeys,...metoceanKeys,...tideKeys,...warningKeys,...geoKeys,...fishKeys]
    .filter(k => M(k)).length;

  const LABELS = {
    wind_speed_ms:            'Wind Speed',
    wind_gust_ms:             'Wind Gust',
    wind_direction_deg:       'Wind Direction',
    visibility_km:            'Visibility',
    precipitation_mm:         'Precipitation',
    wave_height_m:            'Wave Height',
    wave_period_s:            'Wave Period',
    swell_height_m:           'Swell Height',
    current_speed_ms:         'Current Speed',
    sst_c:                    'Sea Temp (SST)',
    tide_height_m:            'Tide Height',
    tidal_current_ms:         'Tidal Current',
    official_warning_active:  'Official Warning',
    inside_prohibited_zone:   'Prohibited Zone',
    zone_name:                'Zone Name',
    zone_category:            'Zone Category',
    constraint_type:          'Constraint Type',
    water_depth_m:            'Water Depth',
    distance_to_boundary_km:  'Boundary Distance',
    nearest_boundary_name:    'Nearest Boundary',
    pfz_suitability_score:    'PFZ Suitability',
    sst_gradient:             'SST Gradient',
    distance_to_pfz_km:       'Dist. to PFZ',
    target_species:           'Target Species',
    chlorophyll_mg_m3:        'Chlorophyll',
    dissolved_oxygen_mmol_m3: 'Dissolved O₂',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-3xl w-full max-w-2xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-base)] bg-[var(--bg-base)] flex-shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <span className="text-xl font-black text-[var(--text-primary)]">{pid}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--bg-surface-2)] text-[var(--text-secondary)]">
              {point.lat !== undefined && point.lat !== null
                ? `${Number(point.lat).toFixed(3)}°N, ${Number(point.lon).toFixed(3)}°E`
                : t('pointDetail.quadrantCenter')}
            </span>
            {isLand && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-surface-2)] text-[var(--text-secondary)] border border-[var(--border-base)]">
                LAND
              </span>
            )}
            {totalAvailable > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-dim)] text-[var(--accent-primary)] border border-[var(--accent-primary)]">
                {totalAvailable}/26
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable Body ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

          {/* Land point notice */}
          {isLand && (
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-[var(--border-base)] text-center">
              <MapPin className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
              <p className="text-sm font-bold text-[var(--text-secondary)]">Land Point — Analysis Not Applicable</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">This grid point falls on land and was excluded from safety scoring.</p>
            </div>
          )}

          {/* Risk Score card — only if sea point */}
          {!isLand && (
            <div className={`p-4 rounded-2xl border ${color.bg} ${color.border} flex items-center justify-between`}>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('pointDetail.riskAssessment')}</div>
                <div className={`text-3xl font-black ${color.text} mt-0.5`}>
                  {score !== null ? (
                    <>{score}<span className="text-sm font-semibold text-[var(--text-secondary)]"> / 100</span></>
                  ) : (
                    <span className="text-lg font-bold text-[var(--text-secondary)]">{t('grid.unrated')}</span>
                  )}
                </div>
              </div>
              <div className="text-right space-y-1">
                <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border ${color.border} ${color.text} bg-[var(--bg-base)]`}>
                  {level}
                </span>
                {risk.confidence && (
                  <div className="text-[10px] text-[var(--text-muted)] font-mono">
                    conf. {Math.round(risk.confidence * 100)}%
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Score Breakdown */}
          {!isLand && (score !== null || baseline !== null) && (
            <div className="p-3.5 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-base)] space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center space-x-1.5">
                <Scale className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{t('pointDetail.auditTrail')}</span>
              </h4>
              <div className="space-y-1.5 text-xs text-[var(--text-secondary)] font-mono">
                <div className="flex justify-between">
                  <span>{t('pointDetail.baselineScore')}:</span>
                  <span className="font-bold text-[var(--text-primary)]">{baseline !== null ? baseline : t('pointDetail.unavailable')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pointDetail.llmDelta')}:</span>
                  <span className={`font-bold ${llmAdj !== null && llmAdj >= 0 ? 'text-[var(--caution-bright)]' : 'text-[var(--safe-bright)]'}`}>
                    {llmAdj !== null ? (llmAdj >= 0 ? `+${llmAdj}` : llmAdj) : '0'}
                  </span>
                </div>
                {hardFloor !== null && (
                  <div className="flex justify-between text-[var(--dangerous-bright)]">
                    <span>{t('pointDetail.deterministicFloor')}:</span>
                    <span className="font-bold">{hardFloor} ({t('pointDetail.floored')})</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-[var(--border-base)] flex justify-between font-sans text-sm font-bold text-[var(--text-primary)]">
                  <span>{t('pointDetail.finalScore')}:</span>
                  <span className={color.text}>{score !== null ? score : t('grid.unrated')}</span>
                </div>
              </div>
              {(hardRules.length > 0 || (score !== null && score >= 80)) && (
                <div className="mt-1.5 p-2.5 rounded-xl bg-rose-950/60 border border-[var(--dangerous)] text-rose-200 text-xs flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-[var(--dangerous-bright)] mt-0.5 flex-shrink-0" />
                  <span><strong>{t('pointDetail.deterministicFloorEnforced')}: </strong>{t('pointDetail.deterministicFloorDesc')}</span>
                </div>
              )}
            </div>
          )}

          {/* Risk Factors */}
          {!isLand && riskFactors.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {t('pointDetail.identifiedHazards')}:
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {riskFactors.map((factor, idx) => (
                  <span key={idx} className="px-2 py-1 rounded-lg bg-amber-950/60 border border-amber-700/60 text-[var(--caution-bright)] text-[10px] font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>{typeof factor === 'string' ? factor.replace(/_/g, ' ') : JSON.stringify(factor)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              MEASUREMENT SECTIONS — all 26 parameters
          ═══════════════════════════════════════════════════════ */}

          {/* 1. Weather */}
          <Section icon={Wind} title="Weather" color="text-sky-400" defaultOpen>
            {weatherKeys.map(k => {
              const m = M(k);
              if (!m) return null;
              return <MeasTile key={k} label={LABELS[k]} mKey={k} m={m} isHazard={isHazard(k)} />;
            })}
          </Section>

          {/* 2. Metocean */}
          <Section icon={Waves} title="Metocean" color="text-blue-400" defaultOpen>
            {metoceanKeys.map(k => {
              const m = M(k);
              if (!m) return null;
              return <MeasTile key={k} label={LABELS[k]} mKey={k} m={m} isHazard={isHazard(k)} />;
            })}
          </Section>

          {/* 3. Tides */}
          <Section icon={Navigation} title="Tides" color="text-[var(--accent-primary)]" defaultOpen>
            {tideKeys.map(k => {
              const m = M(k);
              if (!m) return null;
              return <MeasTile key={k} label={LABELS[k]} mKey={k} m={m} isHazard={isHazard(k)} />;
            })}
          </Section>

          {/* 4. Warnings & Zones */}
          <Section icon={ShieldAlert} title="Warnings & Zones" color="text-[var(--dangerous-bright)]" defaultOpen>
            {/* Boolean tiles */}
            {['official_warning_active','inside_prohibited_zone'].map(k => {
              const m = M(k);
              if (!m) return null;
              return <MeasTile key={k} label={LABELS[k]} mKey={k} m={m} isHazard={isHazard(k)} />;
            })}
            {/* Text tiles — span full width */}
            {['zone_name','zone_category','constraint_type'].map(k => {
              const m = M(k);
              if (!m) return null;
              return <TextTile key={k} label={LABELS[k]} mKey={k} m={m} isHazard={isHazard(k)} />;
            })}
          </Section>

          {/* 5. Geography & Boundaries */}
          <Section icon={MapPin} title="Geography & Boundaries" color="text-violet-400" defaultOpen>
            {['water_depth_m','distance_to_boundary_km'].map(k => {
              const m = M(k);
              if (!m) return null;
              return <MeasTile key={k} label={LABELS[k]} mKey={k} m={m} isHazard={isHazard(k)} />;
            })}
            {M('nearest_boundary_name') && (
              <TextTile label={LABELS['nearest_boundary_name']} mKey="nearest_boundary_name" m={M('nearest_boundary_name')} isHazard={false} />
            )}
          </Section>

          {/* 6. Fishing Intelligence (PFZ + Ecosystem) */}
          <Section icon={Fish} title="Fishing Intelligence" color="text-[var(--safe-bright)]" defaultOpen={false}>
            {['pfz_suitability_score','sst_gradient','distance_to_pfz_km','chlorophyll_mg_m3','dissolved_oxygen_mmol_m3'].map(k => {
              const m = M(k);
              if (!m) return null;
              return <MeasTile key={k} label={LABELS[k]} mKey={k} m={m} isHazard={isHazard(k)} />;
            })}
            {M('target_species') && (
              <TextTile label={LABELS['target_species']} mKey="target_species" m={M('target_species')} isHazard={false} />
            )}
          </Section>

          {/* No data fallback */}
          {totalAvailable === 0 && !isLand && (
            <div className="p-4 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-base)] text-center text-[var(--text-muted)] text-xs">
              No measurement data available for this point.
            </div>
          )}

          {/* Data timestamp footer */}
          {M('wind_speed_ms')?.valid_time && (
            <div className="flex items-center space-x-1.5 text-[10px] text-slate-600 pt-1">
              <Clock className="w-3 h-3" />
              <span>Valid: {new Date(M('wind_speed_ms').valid_time).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-[var(--border-base)] bg-[var(--bg-base)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-bold text-xs transition-colors cursor-pointer"
          >
            {t('pointDetail.closeDetail')}
          </button>
        </div>
      </div>
    </div>
  );
}
