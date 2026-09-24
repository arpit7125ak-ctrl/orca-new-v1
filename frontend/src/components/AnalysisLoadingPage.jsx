/**
 * ============================================================================
 * ORCA Multi-Agent Execution Progress ("ORCA IS ANALYZING")
 * (src/components/AnalysisLoadingPage.jsx)
 * ============================================================================
 * Real-time execution dashboard displayed while the pipeline processes a query (Page 2 Progress).
 * 
 * Architectural Compliance (Architecture Spec §6, §79):
 * 1. Live Step Progression: Displays real-time state for each specialized agent:
 *    - Location Agent (Gazetteer & coordinate validation)
 *    - Weather Agent (IMD / ECMWF atmospheric winds, gusts, visibility)
 *    - Ocean Agent (INCOIS / Copernicus SWH, swell, tides)
 *    - Ecosystem Agent (PFZ, chlorophyll, water quality)
 *    - Risk Agent (Deterministic rule evaluation & LLM safety reasoning)
 *    - Decision Agent (Synthesizing one-line & detailed recommendations)
 * 2. Execution Clock: Live elapsed timer counting seconds since submission.
 * 3. Completion Transition: Unlocks the "View Safety Advisory" action button once done.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle2, 
  Loader2, 
  Circle, 
  Cpu, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  MapPin, 
  CloudSun, 
  Waves, 
  ShieldAlert, 
  Scale, 
  Compass 
} from 'lucide-react';

/**
 * Analysis Loading & Live Swarm Telemetry Component.
 * 
 * @param {Object} props
 * @param {string} props.analysisId - Unique analysis identifier (e.g. req_20260924_...).
 * @param {Object|null} props.statusInfo - Live polling status payload from /analysis/:id/status.
 * @param {Function} props.onViewResults - Navigation callback to transition to Results Hub.
 * @param {boolean} props.isCompleted - Whether the backend analysis has completed.
 */
export default function AnalysisLoadingPage({ 
  analysisId, 
  statusInfo, 
  onViewResults, 
  isCompleted 
}) {
  const { t } = useTranslation('ui');
  const [elapsed, setElapsed] = useState(0);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const agentSteps = [
    {
      id: 'location',
      nameKey: 'loading.locationAgent',
      icon: MapPin,
      pendingKey: 'loading.location_pending',
      activeKey: 'loading.location_active',
      doneKey: 'loading.location_done',
    },
    {
      id: 'weather',
      nameKey: 'loading.weatherAgent',
      icon: CloudSun,
      pendingKey: 'loading.weather_pending',
      activeKey: 'loading.weather_active',
      doneKey: 'loading.weather_done',
    },
    {
      id: 'ocean',
      nameKey: 'loading.oceanAgent',
      icon: Waves,
      pendingKey: 'loading.ocean_pending',
      activeKey: 'loading.ocean_active',
      doneKey: 'loading.ocean_done',
    },
    {
      id: 'ecosystem',
      nameKey: 'loading.ecosystemAgent',
      icon: ShieldAlert,
      pendingKey: 'loading.ecosystem_pending',
      activeKey: 'loading.ecosystem_active',
      doneKey: 'loading.ecosystem_done',
    },
    {
      id: 'risk',
      nameKey: 'loading.riskAgent',
      icon: Scale,
      pendingKey: 'loading.risk_pending',
      activeKey: 'loading.risk_active',
      doneKey: 'loading.risk_done',
    },
    {
      id: 'decision',
      nameKey: 'loading.decisionAgent',
      icon: Compass,
      pendingKey: 'loading.decision_pending',
      activeKey: 'loading.decision_active',
      doneKey: 'loading.decision_done',
    },
  ];

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 100);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Step progression animation based on elapsed time or isCompleted
  useEffect(() => {
    if (isCompleted) {
      setActiveStepIndex(agentSteps.length);
    } else {
      const step = Math.min(agentSteps.length - 1, Math.floor(elapsed / 1200));
      setActiveStepIndex(step);
    }
  }, [elapsed, isCompleted]);

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-10 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center space-y-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 animate-pulse" />

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 text-xs font-mono font-bold">
          <Cpu className="w-3.5 h-3.5 animate-spin-slow" />
          <span>{t('loading.swarmActive')}</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
          {t('loading.title')}
        </h2>

        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          {t('loading.subtitle')}
        </p>

        <div className="flex items-center justify-center space-x-4 text-xs font-mono pt-2 text-slate-400">
          <span>{t('loading.mission')} <b className="text-cyan-300">{analysisId || 'req_live_query'}</b></span>
          <span>•</span>
          <span className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t('loading.elapsed', { n: (elapsed / 1000).toFixed(1) })}</span>
          </span>
        </div>
      </div>

      {/* Step-by-Step Multi-Agent Visual Checklist */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-4">
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('loading.pipelineSteps')}
          </h3>
          <span className="text-xs font-mono text-cyan-400 font-bold">
            {isCompleted ? t('loading.allCompleted', { count: 6 }) : t('loading.inProgressSteps', { step: Math.min(6, activeStepIndex + 1), total: 6 })}
          </span>
        </div>

        <div className="space-y-3 pt-2">
          {agentSteps.map((agent, index) => {
            const Icon = agent.icon;
            const isDone = isCompleted || index < activeStepIndex;
            const isActive = !isCompleted && index === activeStepIndex;
            const isPending = !isCompleted && index > activeStepIndex;

            return (
              <div
                key={agent.id}
                className={`p-4 rounded-2xl border transition-all duration-300 ${
                  isDone
                    ? 'bg-slate-950/60 border-emerald-900/40 text-slate-200'
                    : isActive
                    ? 'bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/40 shadow-lg text-white'
                    : 'bg-slate-950/30 border-slate-800/60 text-slate-500'
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  {/* Status Indicator Icon */}
                  <div className="mt-0.5 flex-shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-700" />
                    )}
                  </div>

                  {/* Agent Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Icon className={`w-4 h-4 ${isDone ? 'text-emerald-400' : isActive ? 'text-cyan-400' : 'text-slate-600'}`} />
                        <h4 className={`text-sm font-bold tracking-tight ${isDone ? 'text-white' : isActive ? 'text-cyan-300' : 'text-slate-400'}`}>
                          {t(agent.nameKey)}
                        </h4>
                      </div>

                      {/* State Badge */}
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                        isDone 
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                          : isActive
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 animate-pulse'
                          : 'bg-slate-900 text-slate-600'
                      }`}>
                        {isDone ? t('common.completed') : isActive ? t('common.executing') : t('common.waiting')}
                      </span>
                    </div>

                    <p className={`text-xs mt-1 leading-relaxed ${
                      isDone ? 'text-slate-300' : isActive ? 'text-cyan-100/90 font-medium' : 'text-slate-500'
                    }`}>
                      {isDone ? t(agent.doneKey) : isActive ? t(agent.activeKey) : t(agent.pendingKey)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Completion Action CTA */}
        {isCompleted && (
          <div className="pt-4 border-t border-slate-800 animate-fade-in">
            <button
              onClick={onViewResults}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-xl shadow-emerald-500/20 cursor-pointer"
            >
              <span>{t('loading.viewAdvisory')}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
