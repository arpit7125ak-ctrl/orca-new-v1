import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Clock, ShieldCheck } from 'lucide-react';

export default function ProgressTracker({ statusInfo }) {
  const steps = [
    { key: 'parse', label: '1. Query NLP & Language Detection', desc: 'Analyzing intent and maritime entities' },
    { key: 'plan', label: '2. Shoreline Snapping & Agent Planning', desc: 'Validating ocean coordinates & specialists' },
    { key: 'agents', label: '3. Multi-Agent 9-Point Spatial Execution', desc: 'Weather, waves, tides & hazards' },
    { key: 'rules', label: '4. Deterministic Constraint Floor Check', desc: 'Strict vessel safety limits enforcement' },
    { key: 'synthesis', label: '5. LLM Advisory & Audio Generation', desc: 'Gemini reasoning & actionable guidance' },
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
            <h3 className="text-sm font-bold text-white">Multi-Agent Intelligence in Progress</h3>
            <p className="text-[11px] text-slate-400">Analysis ID: <span className="font-mono text-cyan-400">{statusInfo?.analysis_id || 'Generating...'}</span></p>
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
                <span className="truncate">{step.label.split('.')[1] || step.label}</span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
