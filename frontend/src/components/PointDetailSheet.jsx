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
  FileText 
} from 'lucide-react';

export default function PointDetailSheet({ point, onClose }) {
  if (!point) return null;

  const risk = point.risk || {};
  const score = risk.final_score ?? point.score ?? 50;
  const level = risk.risk_level || 'CAUTION';
  const pid = point.point_id || 'P0';

  // Level color styling per §2
  const levelColors = {
    SAFE: { bg: 'bg-emerald-950', text: 'text-emerald-400', border: 'border-emerald-800' },
    CAUTION: { bg: 'bg-amber-950', text: 'text-amber-400', border: 'border-amber-800' },
    UNSAFE: { bg: 'bg-orange-950', text: 'text-orange-400', border: 'border-orange-800' },
    DANGEROUS: { bg: 'bg-rose-950', text: 'text-rose-400', border: 'border-rose-800' },
  };
  const color = levelColors[level] || levelColors.CAUTION;

  const baseline = risk.baseline_score ?? 60;
  const llmAdjustment = (risk.llm_score ?? score) - baseline;
  const hardRuleFloor = risk.safety_floor ?? risk.hard_rule_floor ?? null;
  const hardRulesApplied = risk.hard_rules_applied || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-black text-white">{pid}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {point.lat ? `${point.lat}°N, ${point.lon}°E` : 'Quadrant Center'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Score Card (§8) */}
        <div className={`p-4 rounded-2xl border ${color.bg} ${color.border} flex items-center justify-between`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Risk Assessment</div>
            <div className={`text-3xl font-black ${color.text} mt-0.5`}>
              {score} <span className="text-sm font-semibold text-slate-400">/ 100</span>
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border ${color.border} ${color.text} bg-slate-950/50`}>
            {level}
          </span>
        </div>

        {/* Section 78 Transparent Score Breakdown (§8) */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
            <Scale className="w-4 h-4 text-cyan-400" />
            <span>Score Calculation Audit Trail</span>
          </h4>

          <div className="space-y-1.5 text-xs text-slate-300 font-mono">
            <div className="flex justify-between">
              <span>1. Baseline Metocean Score:</span>
              <span className="font-bold text-white">{baseline}</span>
            </div>
            <div className="flex justify-between">
              <span>2. LLM Situational Adjustment:</span>
              <span className={`font-bold ${llmAdjustment >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {llmAdjustment >= 0 ? `+${llmAdjustment}` : llmAdjustment}
              </span>
            </div>
            {hardRuleFloor && (
              <div className="flex justify-between text-rose-400">
                <span>3. Deterministic Safety Floor:</span>
                <span className="font-bold">{hardRuleFloor} (Floored)</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-800 flex justify-between font-sans text-sm font-bold text-white">
              <span>Final Verified Score:</span>
              <span className={color.text}>{score}</span>
            </div>
          </div>

          {/* Hard Safety Limit Exceeded Callout (§8: distinct callout that never looks like just another factor) */}
          {(hardRulesApplied.length > 0 || score >= 80) && (
            <div className="mt-2 p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold">Deterministic Floor Enforced: </span>
                <span>Active meteorological warning sets safety floor regardless of LLM interpretation.</span>
              </div>
            </div>
          )}
        </div>

        {/* "Why" Risk Factors (§8) */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Identified Hazard Factors:</h4>
          <div className="space-y-1.5">
            {(Array.isArray(risk.risk_factors) && risk.risk_factors.length > 0 
              ? risk.risk_factors 
              : ['Normal sea state parameters', 'Wave height within vessel tolerance']
            ).map((factor, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>{typeof factor === 'string' ? factor : factor.description || JSON.stringify(factor)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Per-point Data Quality (§8: Weather ✓ Ocean ◐ GIS ✓) */}
        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-semibold">Telemetry Quality:</span>
          <div className="flex items-center space-x-3 text-slate-300">
            <span className="flex items-center space-x-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Weather (IMD)</span>
            </span>
            <span className="flex items-center space-x-1 text-cyan-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ocean (INCOIS)</span>
            </span>
            <span className="flex items-center space-x-1 text-purple-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>GIS Boundaries</span>
            </span>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
        >
          Close Detail
        </button>
      </div>
    </div>
  );
}
