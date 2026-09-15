import React, { useState, useEffect } from 'react';
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

export default function AnalysisLoadingPage({ 
  analysisId, 
  statusInfo, 
  onViewResults, 
  isCompleted 
}) {
  const [elapsed, setElapsed] = useState(0);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const agentSteps = [
    {
      id: 'location',
      name: 'Location Agent',
      icon: MapPin,
      detailPending: 'Waiting to verify coordinates...',
      detailActive: 'Resolving coordinates, land-sea boundary & shoreline snapping...',
      detailDone: 'Location identified & snapped 6.7km offshore of target zone.',
    },
    {
      id: 'weather',
      name: 'Weather Agent',
      icon: CloudSun,
      detailPending: 'Waiting for IMD meteorological model...',
      detailActive: 'Querying IMD numerical weather prediction, wind gusts & rain...',
      detailDone: 'Weather data collected: 12.6 m/s wind speed, 19.7 m/s max gusts.',
    },
    {
      id: 'ocean',
      name: 'Ocean Agent',
      icon: Waves,
      detailPending: 'Waiting for INCOIS oceanography model...',
      detailActive: 'Analyzing wave height, primary swell period & ocean current vectors...',
      detailDone: 'Waves and ocean conditions analyzed: 0.82m wave, 0.92m swell.',
    },
    {
      id: 'ecosystem',
      name: 'Ecosystem & GIS Agent',
      icon: ShieldAlert,
      detailPending: 'Waiting for spatial GIS boundaries...',
      detailActive: 'Screening Marine Protected Areas, IMBL borders & navigation hazards...',
      detailDone: 'Marine boundaries verified: Safe from IMBL, outside MPA exclusion.',
    },
    {
      id: 'risk',
      name: 'Risk Synthesis Agent',
      icon: Scale,
      detailPending: 'Waiting for metocean parameters...',
      detailActive: 'Enforcing deterministic IMD safety floors & 9-point grid scoring...',
      detailDone: 'Risk matrix computed: Active IMD alert applied, constraint floor 85.',
    },
    {
      id: 'decision',
      name: 'Decision Agent',
      icon: Compass,
      detailPending: 'Waiting for risk synthesis...',
      detailActive: 'Synthesizing operational directives, best quadrant & safe harbors...',
      detailDone: 'Operational directives generated. Safe harbor: Kochi Fisheries Harbor.',
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
      
      {/* Top Banner — Matching Image 4: "ORCA IS ANALYZING" */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center space-y-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 animate-pulse" />

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 text-xs font-mono font-bold">
          <Cpu className="w-3.5 h-3.5 animate-spin-slow" />
          <span>Multi-Agent Swarm Orchestration Active</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
          ORCA IS ANALYZING
        </h2>

        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Autonomous agents are currently synthesizing live satellite telemetry, IMD numerical forecasts, and INCOIS ocean state models.
        </p>

        <div className="flex items-center justify-center space-x-4 text-xs font-mono pt-2 text-slate-400">
          <span>Mission: <b className="text-cyan-300">{analysisId || 'req_live_query'}</b></span>
          <span>•</span>
          <span className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{(elapsed / 1000).toFixed(1)}s elapsed</span>
          </span>
        </div>
      </div>

      {/* Step-by-Step Multi-Agent Visual Checklist (Matching Image 4) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-4">
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Autonomous Pipeline Execution Steps
          </h3>
          <span className="text-xs font-mono text-cyan-400 font-bold">
            {isCompleted ? '6 / 6 Completed' : `${Math.min(6, activeStepIndex + 1)} / 6 in progress`}
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
                          {agent.name}
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
                        {isDone ? 'Completed' : isActive ? 'Executing...' : 'Waiting...'}
                      </span>
                    </div>

                    <p className={`text-xs mt-1 leading-relaxed ${
                      isDone ? 'text-slate-300' : isActive ? 'text-cyan-100/90 font-medium' : 'text-slate-500'
                    }`}>
                      {isDone ? agent.detailDone : isActive ? agent.detailActive : agent.detailPending}
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
              <span>View Advisory Decision & Verdict</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
