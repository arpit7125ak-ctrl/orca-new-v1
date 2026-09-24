/**
 * ============================================================================
 * ORCA Compact Pipeline Progress Tracker (src/components/ProgressTracker.jsx)
 * ============================================================================
 * Compact horizontal stepper visualizing the 5 core stages of pipeline execution.
 * 
 * Execution Stages:
 * 1. Parse (Input validation, location extraction, temporal bounding)
 * 2. Plan (Intent detection and specialist agent selection policy)
 * 3. Agents (Concurrent fan-out to 7 data fetchers: weather, ocean, tide, etc.)
 * 4. Rules (Deterministic maritime safety threshold evaluation)
 * 5. Synthesis (LLM explainable narrative generation and multilingual translation)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertCircle, Clock, ShieldCheck } from 'lucide-react';

/**
 * Compact Progress Tracker Component.
 * 
 * @param {Object} props
 * @param {Object|null} props.statusInfo - Analysis status descriptor containing status and analysis_id.
 */
export default function ProgressTracker({ statusInfo }) {
  const { t } = useTranslation('ui');

  // 5 discrete steps in the ORCA execution pipeline
  const steps = [
    { key: 'parse',     labelKey: 'progress.step1Label', descKey: 'progress.step1Desc' },
    { key: 'plan',      labelKey: 'progress.step2Label', descKey: 'progress.step2Desc' },
    { key: 'agents',    labelKey: 'progress.step3Label', descKey: 'progress.step3Desc' },
    { key: 'rules',     labelKey: 'progress.step4Label', descKey: 'progress.step4Desc' },
    { key: 'synthesis', labelKey: 'progress.step5Label', descKey: 'progress.step5Desc' },
  ];

  const currentStatus = statusInfo?.status || 'queued';
  const progressPercent = currentStatus === 'completed' ? 100 : currentStatus === 'running' ? 65 : 20;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800">
            <Clock className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{t('progress.title')}</h3>
            <p className="text-[11px] text-slate-400">{t('progress.analysisId')} <span className="font-mono text-cyan-400">{statusInfo?.analysis_id || t('progress.generating')}</span></p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-semibold text-cyan-400">{progressPercent}%</span>
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
        <div 
          className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 transition-all duration-500 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step pipeline list */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {steps.map((step, idx) => {
          const isDone = currentStatus === 'completed';
          const isCurrent = currentStatus === 'running' && idx <= 2;
          return (
            <div 
              key={step.key} 
              className={`p-2.5 rounded-xl border text-xs transition-all ${
                isDone
                  ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                  : isCurrent
                  ? 'bg-cyan-950/40 border-cyan-600 text-cyan-200 ring-1 ring-cyan-500/30'
                  : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
              }`}
            >
              <div className="flex items-center space-x-1.5 font-semibold mb-1">
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-700 flex items-center justify-center text-[9px]">
                    {idx + 1}
                  </div>
                )}
                <span className="truncate">{t(step.labelKey)}</span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1">{t(step.descKey)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
