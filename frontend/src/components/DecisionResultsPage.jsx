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
      <div className="text-center py-16 bg-slate-900/60 border border-slate-800 rounded-3xl p-8 space-y-4">
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
        <div className="flex items-center justify-between bg-slate-900/70 border border-slate-800 p-4 rounded-2xl backdrop-blur-md">
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
        <div className="flex items-center justify-between bg-slate-900/70 border border-slate-800 p-4 rounded-2xl backdrop-blur-md">
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
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 p-4 rounded-2xl backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToInput}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
            title={t('results.returnToSetup')}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-semibold">{t('common.setup')}</span>
          </button>

          <div className="text-xs">
            <span className="text-slate-400">{t('results.advisoryReference')} </span>
            <span className="font-mono font-bold text-cyan-300">{aid}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsReportOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>{t('results.advisoryBulletin')}</span>
          </button>

          <button
            onClick={onNewAnalysis}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
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
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/80 border border-slate-800 rounded-2xl">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>{t('results.missionActions')}:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigateToTab && onNavigateToTab('chat')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t('results.askFollowUp')}</span>
          </button>

          <button
            onClick={() => onNavigateToTab && onNavigateToTab('route')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>{t('results.planRoute')}</span>
          </button>

          <button
            onClick={() => setIsReportOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t('results.shareReport')}</span>
          </button>
        </div>
      </div>

      {/* Internal Dashboard Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-800 pb-2 overflow-x-auto">
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
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview & 9-Point Spatial Grid */}
      {activeInternalTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div>
              <MarineMap
                analysis={analysis}
                selectedPoint={selectedPoint}
                onSelectPoint={handleSelectPoint}
              />
            </div>
            <div>
              <PointGrid
                analysis={analysis}
                selectedPoint={selectedPoint}
                onSelectPoint={handleSelectPoint}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ExplainableAi analysis={analysis} />
            <AgenticReasoning analysis={analysis} />
          </div>
        </div>
      )}

      {/* Tab 2: Metocean Charts */}
      {activeInternalTab === 'charts' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-6">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>{t('results.chartTitle')}</span>
            </h3>
            <span className="text-[10px] font-mono text-cyan-400">{t('results.zeroInterpolation')}</span>
          </div>

          {/* Point Risk Bars */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300">{t('results.spatialRiskVariance')}:</h4>
            <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
              {points.map((pt) => {
                const hasScore = typeof pt.risk?.final_score === 'number' && !isNaN(pt.risk.final_score);
                const score = hasScore ? Math.round(pt.risk.final_score) : null;
                const level = pt.risk?.risk_level || 'UNRATED';
                const bg = level === 'SAFE' ? 'bg-emerald-500' : level === 'CAUTION' ? 'bg-amber-400' : level === 'UNRATED' ? 'bg-slate-700' : 'bg-rose-500';
                return (
                  <div key={pt.point_id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
                    <span className="text-xs font-mono font-bold text-white">{pt.point_id}</span>
                    <div className="w-full bg-slate-800 h-16 rounded-lg flex items-end p-1">
                      <div className={`w-full rounded ${bg}`} style={{ height: hasScore ? `${score}%` : '4px' }} />
                    </div>
                    <span className="text-[10px] font-mono text-slate-300">{hasScore ? `${score}/100` : t('grid.unrated')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Evidence & Sources */}
      {activeInternalTab === 'evidence' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>{t('results.evidenceTitle')}</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">{t('results.auditableSources')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">India Meteorological Department (IMD)</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">{t('results.verified')}</span>
              </div>
              <p className="text-xs text-slate-300">
                Atmospheric wind speed, squall gale gusts, visibility indices, and regional coastal weather bulletins.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">INCOIS (Ministry of Earth Sciences)</span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded">{t('results.liveTelemetry')}</span>
              </div>
              <p className="text-xs text-slate-300">
                Significant wave height, primary swell period, sea surface temperature, and Potential Fishing Zone (PFZ) advisories.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Bhuvan / Bhoonidhi (ISRO)</span>
                <span className="text-[10px] font-mono text-purple-400 bg-purple-950 px-2 py-0.5 rounded">{t('results.gisVector')}</span>
              </div>
              <p className="text-xs text-slate-300">
                Marine Protected Area (MPA) polygons, coastal land-sea masking, and 12 NM territorial water baselines.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Ministry of External Affairs (MEA)</span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-950 px-2 py-0.5 rounded">{t('results.sovereignBoundary')}</span>
              </div>
              <p className="text-xs text-slate-300">
                International Maritime Boundary Line (IMBL) coordinates for Tamil Nadu, Gujarat, and Andaman borders.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Data Quality & Freshness */}
      {activeInternalTab === 'quality' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>{t('results.qualityTitle')}</span>
            </h3>
            <span className="text-[10px] font-mono text-emerald-400">{t('results.fullyIngested')}</span>
          </div>

          <div className="space-y-2.5">
            {Object.keys(p0DataQuality).length > 0 ? (
              Object.entries(p0DataQuality).slice(0, 10).map(([param, info]) => {
                const ageHours = info?.freshness?.age_hours;
                const ageText = ageHours !== undefined && ageHours !== null ? `${ageHours}h ago` : (info?.freshness?.state || 'Verified Fresh');
                return (
                  <div key={param} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-white capitalize">{param.replace(/_/g, ' ')}</div>
                      <div className="text-[11px] text-slate-400">{info?.source_note || t('pointDetail.unavailable')}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-emerald-400 font-bold capitalize">✓ {info?.status || 'available'}</div>
                      <div className="text-[10px] text-slate-500">{ageText}</div>
                    </div>
                  </div>
                );
              })
            ) : executionTrace.length > 0 ? (
              executionTrace.map((row, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-white capitalize">{row.agent || row.stage}</div>
                    <div className="text-[11px] text-slate-400">{row.selection_reason || 'Pipeline Stage'}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-emerald-400 font-bold">✓ {row.status}</div>
                    <div className="text-[10px] text-slate-500">{row.duration_ms !== null ? `${row.duration_ms}ms` : '—'}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-500">
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
