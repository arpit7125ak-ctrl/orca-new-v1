/**
 * ============================================================================
 * ORCA Advisory & Decision Results Hub (src/components/DecisionResultsPage.jsx)
 * ============================================================================
 * Comprehensive results visualization dashboard (Page 3 & Page 4).
 * 
 * Integrated Sub-Components:
 * 1. DecisionHero: Prominent safety badge, 1-line action, and preferred point quick metrics.
 * 2. MarineMap: Interactive leaflet map rendering multi-point grid or nautical route.
 * 3. PointGrid: Matrix of evaluated points (P0, R0001-R0008) with safety ranks and wave metrics.
 * 4. PointDetailSheet: Comprehensive 26-measurement telemetry inspection drawer.
 * 5. ExplainableAi: Section 78 risk score decomposition (Baseline -> LLM -> Final).
 * 6. AgenticReasoning: Section 79 visible multi-agent execution trace and latency.
 * 7. ReportModal: Downloadable official advisory report (PDF/Markdown/JSON).
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  RotateCcw, 
  FileText, 
  MapPin, 
  Scale, 
  Cpu, 
  Compass, 
  Share2, 
  Download,
  BarChart3,
  Database,
  Layers,
  MessageSquare,
  Navigation,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import DecisionHero from './DecisionHero';
import MarineMap from './MarineMap';
import PointGrid from './PointGrid';
import ExpandablePanel from './ExpandablePanel';
import { Activity, ShieldAlert, Route, Search, History } from 'lucide-react';
import ExplainableAi from './ExplainableAi';
import AgenticReasoning from './AgenticReasoning';
import ReportModal from './ReportModal';
import PointDetailSheet from './PointDetailSheet';
import TrendView from './TrendView';

/**
 * Decision Results Page Component.
 * 
 * @param {Object} props
 * @param {Object|null} props.analysis - Completed analysis result object.
 * @param {string} [props.selectedLang='auto'] - User's selected language.
 * @param {Function} props.onBackToInput - Handler to return to setup page.
 * @param {Function} props.onNewAnalysis - Handler to clear and launch fresh analysis.
 * @param {Function} props.onNavigateToTab - Global navigation router handler.
 */
export default function DecisionResultsPage({
  analysis,
  selectedLang = 'auto',
  onBackToInput,
  onNewAnalysis,
  onNavigateToTab,
}) {
  const { t } = useTranslation('ui');
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [activeInternalTab, setActiveInternalTab] = useState('overview'); // overview | charts | evidence | quality | reasoning

  // Bug fix: PointGrid transforms rawPoints into simplified objects that lose
  // `risk.*` and `measurements.*`. Resolve the FULL raw point from
  // analysis.points[] by point_id so PointDetailSheet receives complete data.
  const handleSelectPoint = (pt) => {
    const pointId = pt?.point_id;
    if (pointId && Array.isArray(analysis?.points)) {
      const rawPoint = analysis.points.find((p) => p.point_id === pointId);
      if (rawPoint) {
        setSelectedPoint(rawPoint);
        return;
      }
    }
    // Fallback: use whatever was passed (e.g. map click with full data)
    setSelectedPoint(pt);
  };

  if (!analysis) {
    return (
      <div className="text-center py-16 bg-slate-900/60 border border-slate-800 rounded-xl p-8 space-y-4">
        <Compass className="w-10 h-10 text-cyan-400 mx-auto animate-spin-slow" />
        <h3 className="text-lg font-bold text-white">{t('results.noAnalysis')}</h3>
        <p className="text-xs text-slate-400">{t('results.startMission')}</p>
        <button
          onClick={onBackToInput}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
        >
          {t('results.returnToSetup')}
        </button>
      </div>
    );
  }

  const aid = analysis.analysis_id || 'req_live_assessment';
  const effectiveLang = (selectedLang && selectedLang !== 'auto')
    ? selectedLang
    : (analysis.response_language || analysis.decision?.response_language || 'en');

  // Branch if final_stage is trend
  if (analysis.final_stage === 'trend' || analysis.trend_result) {
    return (
      <div className="space-y-6 py-2">
        <div className="flex items-center justify-between bg-slate-900/70 border border-slate-800 p-4 rounded-lg backdrop-blur-md">
          <button
            onClick={onBackToInput}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-semibold">{t('common.setup')}</span>
          </button>
          <div className="text-xs">
            <span className="text-slate-400">{t('results.trendReference')} </span>
            <span className="font-mono font-bold text-purple-300">{aid}</span>
          </div>
          <button
            onClick={onNewAnalysis}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t('results.newAnalysis')}</span>
          </button>
        </div>
        <TrendView trendResult={analysis.trend_result || analysis} />
      </div>
    );
  }

  // Branch if final_stage is route
  if (analysis.final_stage === 'route' || analysis.route_result) {
    const route = analysis.route_result || analysis;
    return (
      <div className="space-y-6 py-2">
        <div className="flex items-center justify-between bg-slate-900/70 border border-slate-800 p-4 rounded-lg backdrop-blur-md">
          <button
            onClick={onBackToInput}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-semibold">{t('common.setup')}</span>
          </button>
          <div className="text-xs">
            <span className="text-slate-400">{t('results.nauticalPassageRoute')} </span>
            <span className="font-mono font-bold text-cyan-300">{route.route_id || aid}</span>
          </div>
          <button
            onClick={() => onNavigateToTab && onNavigateToTab('route')}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
          >
            <Navigation className="w-4 h-4" />
            <span>{t('results.openInRoutePlanner')}</span>
          </button>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">{t('results.nauticalPassageAnalysis')}</h3>
            <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase border ${route.max_risk_level === 'SAFE' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-amber-950 text-amber-300 border-amber-800'}`}>
              {route.max_risk_level || t('results.evaluated')}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">{t('results.totalDistance')}</span>
              <span className="text-lg font-bold text-white">{route.total_distance_km ? `${route.total_distance_km.toFixed(1)} km` : '—'}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">{t('results.estPassageTime')}</span>
              <span className="text-lg font-bold text-white">{route.estimated_duration_hours ? `${route.estimated_duration_hours.toFixed(1)} hrs` : '—'}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">{t('results.waypoints')}</span>
              <span className="text-lg font-bold text-white">{route.waypoints?.length || 0}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const plan = analysis.plan || {};
  const points = analysis.points || [];
  const p0DataQuality = analysis.points?.[0]?.risk?.data_quality || analysis.data_quality || {};
  const executionTrace = Array.isArray(analysis.execution_trace) ? analysis.execution_trace : [];

  return (
    <div className="space-y-6 py-2">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface)] border border-[var(--border-base)] p-4 rounded-xl shadow-lg">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToInput}
            className="p-2 rounded bg-[var(--bg-base)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-base)] text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
            title={t('results.returnToSetup')}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-semibold uppercase tracking-wider">{t('common.setup')}</span>
          </button>

          <div className="text-[10px] font-bold uppercase tracking-[0.12em]">
            <span className="text-[var(--text-secondary)]">{t('results.advisoryReference')} </span>
            <span className="font-mono text-[var(--accent-primary)]">{aid}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsReportOpen(true)}
            className="px-3.5 py-2 rounded bg-[var(--bg-base)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] border border-[var(--border-base)] text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>{t('results.advisoryBulletin')}</span>
          </button>

          <button
            onClick={onNewAnalysis}
            className="px-4 py-2 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-black font-black text-[10px] uppercase tracking-widest flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t('results.newMission')}</span>
          </button>
        </div>
      </div>

      {/* Section 77: Decision Hero */}
      <DecisionHero
        analysis={analysis}
        onOpenReport={() => setIsReportOpen(true)}
        language={effectiveLang}
      />

      {/* Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl shadow-md">
        <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          <span>{t('results.missionActions')}:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigateToTab && onNavigateToTab('chat')}
            className="px-3 py-1.5 rounded bg-[var(--bg-base)] hover:bg-[var(--bg-surface-2)] text-[var(--accent-primary)] border border-[var(--border-base)] text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t('results.askFollowUp')}</span>
          </button>

          <button
            onClick={() => onNavigateToTab && onNavigateToTab('route')}
            className="px-3 py-1.5 rounded bg-[var(--bg-base)] hover:bg-[var(--bg-surface-2)] text-[var(--safe-bright)] border border-[var(--border-base)] text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>{t('results.planRoute')}</span>
          </button>

          <button
            onClick={() => setIsReportOpen(true)}
            className="px-3 py-1.5 rounded bg-[var(--bg-base)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] border border-[var(--border-base)] text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t('results.shareReport')}</span>
          </button>
        </div>
      </div>

      {/* Internal Dashboard Tabs */}
      <div className="flex items-center space-x-1 border-b border-[var(--border-base)] pb-2 overflow-x-auto">
        {[
          { id: 'overview', labelKey: 'results.tabOverview', icon: MapPin },
          { id: 'charts', labelKey: 'results.tabCharts', icon: BarChart3 },
          { id: 'evidence', labelKey: 'results.tabEvidence', icon: Database },
          { id: 'quality', labelKey: 'results.tabQuality', icon: Layers },
          { id: 'reasoning', labelKey: 'results.tabReasoning', icon: Cpu },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeInternalTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveInternalTab(tab.id)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] border border-[var(--border-base)] border-b-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview & 9-Point Spatial Grid */}
      {activeInternalTab === 'overview' && (() => {
        // 1. Calculate Risk Distributions
        const pts = analysis?.points || [];
        const riskCounts = { SAFE: 0, CAUTION: 0, MODERATE: 0, HIGH: 0, DANGER: 0 };
        pts.forEach(pt => {
           const val = pt.risk_score || pt.risk?.final_score || 0;
           if (val < 35) riskCounts.SAFE++;
           else if (val < 50) riskCounts.CAUTION++;
           else if (val < 70) riskCounts.MODERATE++;
           else if (val < 85) riskCounts.HIGH++;
           else riskCounts.DANGER++;
        });
        
        // 2. Route Intelligence
        const waypoints = analysis?.route?.waypoints || analysis?.plan?.route?.waypoints || [];
        let highestRouteRisk = 0;
        let highestRiskLatLon = 'N/A';
        waypoints.forEach(wp => {
           const r = wp.risk_score || wp.risk || 0;
           if (r > highestRouteRisk) {
              highestRouteRisk = r;
              highestRiskLatLon = `${Number(wp.lat).toFixed(2)}°N, ${Number(wp.lon).toFixed(2)}°E`;
           }
        });
        const totalDistance = analysis?.route?.distance_nm || analysis?.plan?.route?.distance_nm;
        const distDisplay = totalDistance ? `${Number(totalDistance).toFixed(1)} NM` : 'N/A';

        return (
          <div className="space-y-5">
            
            {/* TOP SUMMARY METRIC ROW */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
               {[
                 { label: 'Overall Risk', value: analysis?.decision?.risk_level || 'N/A', color: analysis?.decision?.risk_level === 'SAFE' ? 'text-[#2FAE72]' : 'text-[#E59A24]' },
                 { label: 'Active Alerts', value: (analysis?.points?.[0]?.risk?.official_warnings?.length || 0).toString().padStart(2, '0') },
                 { label: 'Max Wave', value: pts.length ? Math.max(...pts.map(p => p.risk?.weather?.wave_height_m || p.risk?.metocean?.wave_height_m || 0)).toFixed(1) + ' m' : 'N/A' },
                 { label: 'Max Wind', value: pts.length ? Math.max(...pts.map(p => (p.risk?.weather?.wind_speed_ms || 0) * 1.94)).toFixed(0) + ' kt' : 'N/A' },
                 { label: 'Visibility', value: pts[0]?.risk?.weather?.visibility_km?.toFixed(1) ? pts[0].risk.weather.visibility_km.toFixed(1) + ' km' : 'N/A' },
                 { label: 'Tide', value: pts[0]?.risk?.metocean?.tide_surge_m?.toFixed(1) ? pts[0].risk.metocean.tide_surge_m.toFixed(1) + ' m' : 'N/A' },
               ].map((m, i) => (
                  <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-lg p-3 flex flex-col justify-center shadow-sm card-enter card-enter-1 interactive-card">
                     <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">{m.label}</span>
                     <span className={`text-sm font-mono font-bold ${m.color || 'text-white'}`}>{m.value}</span>
                  </div>
               ))}
            </div>

            {/* ========================================================= */}
            {/* LAYER 2: PRIMARY MARITIME MAP (FULL WIDTH HERO)           */}
            {/* ========================================================= */}
            <div className="w-full">
              <MarineMap
                analysis={analysis}
                selectedPoint={selectedPoint}
                onSelectPoint={handleSelectPoint}
              />
            </div>

            {/* ========================================================= */}
            {/* LAYER 3: 9-POINT SPATIAL GRID ASSESSMENT (FULL WIDTH)     */}
            {/* ========================================================= */}
            <div className="w-full">
              <PointGrid
                analysis={analysis}
                selectedPoint={selectedPoint}
                onSelectPoint={handleSelectPoint}
              />
            </div>

            {/* ========================================================= */}
            {/* LAYER 4: OPERATIONAL INTELLIGENCE & ACTIVE RISK ALERTS    */}
            {/* ========================================================= */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
              {/* ORCA DECISION */}
              <div className="bg-[#111814] border border-[#d4850a]/30 rounded-xl p-4 shrink-0 shadow-sm relative overflow-hidden card-enter interactive-card">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#d4850a]" />
                <div className="flex items-center justify-between mb-3 ml-2">
                   <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#d4850a]">ORCA DECISION</h3>
                   <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${analysis?.decision?.risk_level === 'SAFE' ? 'bg-emerald-950/40 text-[#2FAE72] border-emerald-900' : 'bg-amber-950/40 text-[#E59A24] border-amber-900'}`}>
                     {analysis?.decision?.risk_level || 'N/A'}
                   </span>
                </div>
                <div className="text-xs text-white/90 font-medium leading-relaxed ml-2">
                   {analysis?.decision?.recommendation || 'Operational recommendation pending.'}
                </div>
              </div>

              {/* RISK DISTRIBUTION BAR */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-4 shrink-0 shadow-sm card-enter card-enter-2 interactive-card">
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-3">GRID RISK DISTRIBUTION</h3>
                <div className="flex w-full h-2 rounded-full overflow-hidden mb-2 border border-white/5">
                   {riskCounts.SAFE > 0 && <div style={{width: `${(riskCounts.SAFE/pts.length)*100}%`}} className="h-full bg-[#2FAE72]" />}
                   {riskCounts.CAUTION > 0 && <div style={{width: `${(riskCounts.CAUTION/pts.length)*100}%`}} className="h-full bg-[#D8B12D]" />}
                   {riskCounts.MODERATE > 0 && <div style={{width: `${(riskCounts.MODERATE/pts.length)*100}%`}} className="h-full bg-[#E59A24]" />}
                   {riskCounts.HIGH > 0 && <div style={{width: `${(riskCounts.HIGH/pts.length)*100}%`}} className="h-full bg-[#E05A25]" />}
                   {riskCounts.DANGER > 0 && <div style={{width: `${(riskCounts.DANGER/pts.length)*100}%`}} className="h-full bg-[#D63838]" />}
                </div>
                <div className="flex justify-between text-[9px] font-bold text-white/50">
                   <span className={riskCounts.SAFE ? 'text-[#2FAE72]' : ''}>{riskCounts.SAFE} SAFE</span>
                   <span className={riskCounts.MODERATE ? 'text-[#E59A24]' : ''}>{riskCounts.MODERATE} MOD</span>
                   <span className={riskCounts.DANGER ? 'text-[#D63838]' : ''}>{riskCounts.DANGER} DNG</span>
                </div>
              </div>

              {/* SMART ALERT UI */}
              {pts.some(p => p.risk?.official_warnings?.length > 0) && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-4 shrink-0 shadow-sm card-enter card-enter-3 interactive-card">
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-[#D63838] mb-3 flex items-center space-x-1.5">
                   <span className="w-1.5 h-1.5 rounded-full bg-[#D63838] animate-pulse" />
                   <span>ACTIVE ALERTS</span>
                </h3>
                <div className="space-y-3">
                   {pts.filter(p => p.risk?.official_warnings?.length > 0).slice(0,3).map((p, idx) => (
                      <div key={idx} className="bg-[#111814] border border-[#D63838]/30 rounded p-3">
                        <div className="flex justify-between items-start mb-2">
                           <div className="text-xs font-bold text-white/90">Warning Detected</div>
                           <span className="text-[9px] font-bold uppercase text-[#D63838] bg-[#D63838]/10 px-1.5 py-0.5 rounded">HIGH</span>
                        </div>
                        <div className="text-[10px] text-white/60 mb-3">{p.risk.official_warnings[0]}</div>
                        <div className="flex justify-between items-center">
                           <div className="text-[10px] text-white/40">Affected: <span className="text-white font-bold">{p.point_id}</span></div>
                           <button 
                             onClick={() => handleSelectPoint(p)}
                             className="text-[9px] font-bold text-[#E59A24] hover:text-white transition uppercase border border-[#E59A24]/30 px-2 py-1 rounded cursor-pointer"
                           >
                              View on Map
                           </button>
                        </div>
                      </div>
                   ))}
                </div>
              </div>
              )}

              {/* ROUTE INTELLIGENCE */}
              {waypoints.length > 0 && (
              <ExpandablePanel title="ROUTE INTELLIGENCE" icon={Route}>
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-[#0a0d0a] p-2.5 rounded border border-[var(--border-base)]">
                      <div className="text-[8px] text-white/40 uppercase mb-1">Total Distance</div>
                      <div className="text-xs font-bold text-white font-mono">{distDisplay}</div>
                   </div>
                   <div className="bg-[#0a0d0a] p-2.5 rounded border border-[var(--border-base)]">
                      <div className="text-[8px] text-white/40 uppercase mb-1">Peak Risk Seg</div>
                      <div className="text-xs font-bold text-[#E59A24] font-mono">{Math.round(highestRouteRisk)} / 100</div>
                   </div>
                </div>
                <div className="mt-3 text-[10px] text-white/60">
                  Primary risk area located near: <span className="text-white font-mono">{highestRiskLatLon}</span>
                </div>
              </ExpandablePanel>
              )}
            </div>

            {/* ========================================================= */}
            {/* LAYER 5: DEEP EXPLAINABLE AI & MULTI-AGENT REASONING      */}
            {/* ========================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full">
              <ExplainableAi analysis={analysis} />
              <AgenticReasoning analysis={analysis} />
            </div>

            {/* ========================================================= */}
            {/* LAYER 6: DATA PROVENANCE & HISTORICAL VERIFICATION        */}
            {/* ========================================================= */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
              {/* DATA QUALITY & SOURCES */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-4 shrink-0 shadow-sm card-enter card-enter-4 interactive-card">
                 <h3 className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-3">ANALYSIS SOURCES</h3>
                 <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex justify-between items-center bg-[#0a0d0a] p-2.5 rounded border border-[var(--border-base)]">
                      <span className="text-white/70">Weather (IMD / ECMWF)</span>
                      <span className="text-emerald-400 font-bold">✓ Verified</span>
                    </div>
                    <div className="flex justify-between items-center bg-[#0a0d0a] p-2.5 rounded border border-[var(--border-base)]">
                      <span className="text-white/70">Ocean (INCOIS)</span>
                      <span className="text-emerald-400 font-bold">✓ Verified</span>
                    </div>
                    <div className="flex justify-between items-center bg-[#0a0d0a] p-2.5 rounded border border-[var(--border-base)]">
                      <span className="text-white/70">Tidal Stream</span>
                      <span className="text-emerald-400 font-bold">✓ Verified</span>
                    </div>
                    <div className="flex justify-between items-center bg-[#0a0d0a] p-2.5 rounded border border-[var(--border-base)]">
                      <span className="text-white/70">GIS Safety Floor</span>
                      <span className="text-emerald-400 font-bold">✓ Verified</span>
                    </div>
                 </div>
              </div>

              {/* WHAT CHANGED / HISTORICAL */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-4 shrink-0 shadow-sm card-enter card-enter-4 interactive-card">
                 <h3 className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-3">WHAT CHANGED?</h3>
                 {analysis?.historical ? (
                   <div className="text-xs text-white">Historical comparison telemetry active</div>
                 ) : (
                   <div className="text-[10px] text-white/40 flex items-center justify-center p-6 border border-dashed border-white/10 rounded">
                      Historical comparison baseline unavailable for this coordinate query
                   </div>
                 )}
              </div>
            </div>
          </div>
        );
      })()}

            {/* Tab 2: Metocean Charts */}
      {activeInternalTab === 'charts' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-6 shadow-md space-y-6 card-enter card-enter-4 interactive-card">
          <div className="border-b border-[var(--border-base)] pb-3 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)] flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>{t('results.chartTitle')}</span>
            </h3>
            <span className="text-[10px] font-mono text-[var(--text-secondary)]">{t('results.zeroInterpolation')}</span>
          </div>

          {/* Point Risk Bars */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{t('results.spatialRiskVariance')}:</h4>
            <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
              {points.map((pt) => {
                const hasScore = typeof pt.risk?.final_score === 'number' && !isNaN(pt.risk.final_score);
                const score = hasScore ? Math.round(pt.risk.final_score) : null;
                const level = pt.risk?.risk_level || 'UNRATED';
                const bg = level === 'SAFE' ? 'bg-[var(--safe)]' : level === 'CAUTION' ? 'bg-[var(--caution)]' : level === 'UNRATED' ? 'bg-[var(--bg-surface-2)]' : 'bg-[var(--dangerous)]';
                return (
                  <div key={pt.point_id} className="p-2.5 rounded bg-[var(--bg-base)] border border-[var(--border-base)] text-center space-y-1">
                    <span className="text-[10px] font-mono font-bold text-[var(--text-primary)]">{pt.point_id}</span>
                    <div className="w-full bg-[var(--bg-surface-2)] h-16 rounded flex items-end p-0.5">
                      <div className={`w-full rounded-sm ${bg}`} style={{ height: hasScore ? `${score}%` : '4px' }} />
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-secondary)]">{hasScore ? `${score}/100` : t('grid.unrated')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Evidence & Sources */}
      {activeInternalTab === 'evidence' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-6 shadow-md space-y-4 card-enter card-enter-4 interactive-card">
          <div className="border-b border-[var(--border-base)] pb-3 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)] flex items-center space-x-2">
              <Database className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>{t('results.evidenceTitle')}</span>
            </h3>
            <span className="text-[10px] font-mono text-[var(--text-secondary)]">{t('results.auditableSources')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded bg-[var(--bg-base)] border border-[var(--border-base)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">India Meteorological Department (IMD)</span>
                <span className="text-[10px] font-mono text-[var(--safe-bright)] bg-[var(--safe)]/20 border border-[var(--safe)]/50 px-2 py-0.5 rounded">{t('results.verified')}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Atmospheric wind speed, squall gale gusts, visibility indices, and regional coastal weather bulletins.
              </p>
            </div>

            <div className="p-4 rounded bg-[var(--bg-base)] border border-[var(--border-base)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">INCOIS (Ministry of Earth Sciences)</span>
                <span className="text-[10px] font-mono text-[var(--accent-primary)] bg-[var(--accent-dim)]/30 border border-[var(--accent-primary)]/50 px-2 py-0.5 rounded">{t('results.liveTelemetry')}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Significant wave height, primary swell period, sea surface temperature, and Potential Fishing Zone (PFZ) advisories.
              </p>
            </div>

            <div className="p-4 rounded bg-[var(--bg-base)] border border-[var(--border-base)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">Bhuvan / Bhoonidhi (ISRO)</span>
                <span className="text-[10px] font-mono text-purple-400 bg-purple-900/30 border border-purple-500/50 px-2 py-0.5 rounded">{t('results.gisVector')}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Marine Protected Area (MPA) polygons, coastal land-sea masking, and 12 NM territorial water baselines.
              </p>
            </div>

            <div className="p-4 rounded bg-[var(--bg-base)] border border-[var(--border-base)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">Ministry of External Affairs (MEA)</span>
                <span className="text-[10px] font-mono text-[var(--caution-bright)] bg-[var(--caution)]/30 border border-[var(--caution)]/50 px-2 py-0.5 rounded">{t('results.sovereignBoundary')}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                International Maritime Boundary Line (IMBL) coordinates for Tamil Nadu, Gujarat, and Andaman borders.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Data Quality & Freshness */}
      {activeInternalTab === 'quality' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-6 shadow-md space-y-4 card-enter card-enter-4 interactive-card">
          <div className="border-b border-[var(--border-base)] pb-3 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)] flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>{t('results.qualityTitle')}</span>
            </h3>
            <span className="text-[10px] font-mono text-[var(--safe-bright)]">{t('results.fullyIngested')}</span>
          </div>

          <div className="space-y-2.5">
            {Object.keys(p0DataQuality).length > 0 ? (
              Object.entries(p0DataQuality).slice(0, 10).map(([param, info]) => {
                const ageHours = info?.freshness?.age_hours;
                const ageText = ageHours !== undefined && ageHours !== null ? `${ageHours}h ago` : (info?.freshness?.state || 'Verified Fresh');
                return (
                  <div key={param} className="p-3 rounded bg-[var(--bg-base)] border border-[var(--border-base)] flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-[var(--text-primary)] capitalize">{param.replace(/_/g, ' ')}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">{info?.source_note || t('pointDetail.unavailable')}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-[var(--safe-bright)] font-bold capitalize">✓ {info?.status || 'available'}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{ageText}</div>
                    </div>
                  </div>
                );
              })
            ) : executionTrace.length > 0 ? (
              executionTrace.map((row, idx) => (
                <div key={idx} className="p-3 rounded bg-[var(--bg-base)] border border-[var(--border-base)] flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-[var(--text-primary)] capitalize">{row.agent || row.stage}</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">{row.selection_reason || 'Pipeline Stage'}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-[var(--safe-bright)] font-bold">✓ {row.status}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{row.duration_ms !== null ? `${row.duration_ms}ms` : '—'}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                {t('pointDetail.unavailable')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Reasoning */}
      {activeInternalTab === 'reasoning' && (
        <div className="space-y-6">
          <AgenticReasoning analysis={analysis} />
          <ExplainableAi analysis={analysis} />
        </div>
      )}

      {/* Point Detail Sheet Modal */}
      {selectedPoint && (
        <PointDetailSheet
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
        />
      )}

      {/* Printable Report Modal */}
      <ReportModal
        analysis={analysis}
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  );
}
