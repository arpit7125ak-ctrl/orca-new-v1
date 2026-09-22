import React from 'react';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Waves, 
  Wind, 
  Eye, 
  Scale, 
  Clock, 
  FileText,
  Database
} from 'lucide-react';

export default function PointDetailSheet({ point, onClose }) {
  if (!point) return null;

  const risk = point.risk || {};
  const hasScore = risk.final_score !== null && risk.final_score !== undefined;
  const score = hasScore ? Math.round(risk.final_score) : (point.risk_score !== null && point.risk_score !== undefined ? Math.round(point.risk_score) : null);
  const level = risk.risk_level || point.status || 'UNRATED';
  const pid = point.point_id || 'P0';

  const levelColors = {
    SAFE: { bg: 'bg-emerald-950', text: 'text-emerald-400', border: 'border-emerald-800' },
    CAUTION: { bg: 'bg-amber-950', text: 'text-amber-400', border: 'border-amber-800' },
    UNSAFE: { bg: 'bg-orange-950', text: 'text-orange-400', border: 'border-orange-800' },
    DANGEROUS: { bg: 'bg-rose-950', text: 'text-rose-400', border: 'border-rose-800' },
    UNRATED: { bg: 'bg-slate-950', text: 'text-slate-400', border: 'border-slate-800' },
  };
  const color = levelColors[level] || levelColors.UNRATED;

  const rawBaseline = risk.baseline_score ?? null;
  const baseline = rawBaseline !== null ? Math.round(rawBaseline) : null;
  const llmAdjustment = risk.llm_adjustment ?? (score !== null && baseline !== null ? score - baseline : null);
  const hardRuleFloor = risk.constraint_floor ?? risk.safety_floor ?? null;
  const hardRulesApplied = risk.hard_rules_applied || [];

  const rawFactors = risk.risk_factors || [];
  const riskFactors = Array.isArray(rawFactors) && rawFactors.length > 0 ? rawFactors : [];

  const measurements = point.measurements || {};
  const measurementEntries = Object.entries(measurements);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-black text-white">{pid}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {point.lat !== undefined && point.lat !== null ? `${Number(point.lat).toFixed(3)}°N, ${Number(point.lon).toFixed(3)}°E` : 'Quadrant Center'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Score Card */}
        <div className={`p-4 rounded-2xl border ${color.bg} ${color.border} flex items-center justify-between`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Risk Assessment</div>
            <div className={`text-3xl font-black ${color.text} mt-0.5`}>
              {score !== null ? (
                <>
                  {score} <span className="text-sm font-semibold text-slate-400">/ 100</span>
                </>
              ) : (
                <span className="text-lg font-bold text-slate-400">Unrated</span>
              )}
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border ${color.border} ${color.text} bg-slate-950/50`}>
            {level}
          </span>
        </div>

        {/* Transparent Score Breakdown */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
            <Scale className="w-4 h-4 text-cyan-400" />
            <span>Score Calculation Audit Trail</span>
          </h4>

          <div className="space-y-1.5 text-xs text-slate-300 font-mono">
            <div className="flex justify-between">
              <span>1. Baseline Metocean Score:</span>
              <span className="font-bold text-white">{baseline !== null ? baseline : 'Unavailable'}</span>
            </div>
            <div className="flex justify-between">
              <span>2. LLM Situational Delta:</span>
              <span className={`font-bold ${llmAdjustment !== null && llmAdjustment >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {llmAdjustment !== null ? (llmAdjustment >= 0 ? `+${llmAdjustment}` : llmAdjustment) : '0'}
              </span>
            </div>
            {hardRuleFloor !== null && (
              <div className="flex justify-between text-rose-400">
                <span>3. Deterministic Safety Floor:</span>
                <span className="font-bold">{hardRuleFloor} (Floored)</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-800 flex justify-between font-sans text-sm font-bold text-white">
              <span>Final Synthesized Score:</span>
              <span className={color.text}>{score !== null ? score : 'Unrated'}</span>
            </div>
          </div>

          {/* Hard Safety Limit Exceeded Callout */}
          {(hardRulesApplied.length > 0 || (score !== null && score >= 80)) && (
            <div className="mt-2 p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold">Deterministic Floor Enforced: </span>
                <span>Active meteorological warning or high risk condition sets safety floor regardless of LLM interpretation.</span>
              </div>
            </div>
          )}
        </div>

        {/* Identified Risk Factors */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Identified Hazard Factors:</h4>
          {riskFactors.length > 0 ? (
            <div className="space-y-1.5">
              {riskFactors.map((factor, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start space-x-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>{typeof factor === 'string' ? factor.replace(/_/g, ' ') : factor.description || JSON.stringify(factor)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500">
              No adverse hazard factors detected for this point.
            </div>
          )}
        </div>

        {/* Real Per-point Measurements / Sources */}
        {measurementEntries.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sensor Measurements & Provenance</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {measurementEntries.slice(0, 6).map(([k, m]) => (
                <div key={k} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block truncate capitalize">{k.replace(/_/g, ' ')}</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono text-white text-xs font-bold">{m?.value !== undefined && m?.value !== null ? m.value : '—'}</span>
                    <span className="text-[10px] text-cyan-400 font-mono">{m?.source || 'Observed'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
        >
          Close Detail
        </button>
      </div>
    </div>
  );
}
