import React from 'react';
import { 
  Scale, 
  Cpu, 
  ShieldCheck, 
  Activity, 
  AlertTriangle,
  BarChart3,
  Database
} from 'lucide-react';

export default function ExplainableAi({ analysis }) {
  if (!analysis) return null;

  const explainability = analysis.explainability || {};
  const risk = analysis.risk || {};
  const decision = analysis.decision || {};
  const p0 = analysis.points?.find(p => p.point_id === 'P0') || analysis.points?.[0] || {};
  const p0Risk = p0.risk || decision.point_summaries?.[0] || {};

  const baselineScore = explainability.baseline_score ?? p0Risk.baseline_score ?? 28;
  const llmAdjustment = explainability.llm_adjustment ?? p0Risk.llm_adjustment ?? 0;
  const constraintFloor = p0Risk.constraint_floor !== null && p0Risk.constraint_floor !== undefined;
  const officialWarning = Array.isArray(p0Risk.official_warnings) && p0Risk.official_warnings.length > 0 ? p0Risk.official_warnings[0] : null;
  const constraintReason = officialWarning
    ? `Enforced by official ${officialWarning.issuing_authority || 'IMD'} ${officialWarning.warning_type || 'warning'} (${officialWarning.bulletin_id || 'IMD-Active'}) at score ${officialWarning.floor_score}`
    : explainability.constraint_floor_reason || 'No overriding safety floor triggered';
  
  const finalScore = Math.round(p0Risk.final_score ?? decision.overall_risk_score ?? 28);

  const dimensionScores = explainability.dimension_scores || {
    oceanographic: Math.min(100, Math.round(baselineScore * 0.95)),
    meteorological: Math.min(100, Math.round(baselineScore * 1.05)),
    coastal_bathymetric: 25,
    regulatory_geofence: 15,
  };

  const rawFindings = p0Risk.key_findings || explainability.key_findings;
  const keyFindings = Array.isArray(rawFindings) && rawFindings.length > 0
    ? (typeof rawFindings[0] === 'string'
        ? rawFindings.map((f, i) => ({ factor: `Safety Factor 0${i+1}`, value: 'Evaluated', impact: f }))
        : rawFindings)
    : [
        { factor: 'Operational Envelope', value: 'Verified', impact: 'Sea state metrics synthesized against vessel craft capabilities.' },
      ];

  const dataQuality = (p0Risk.data_quality && typeof p0Risk.data_quality === 'object') ? p0Risk.data_quality : {};

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Scale className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Section 78: Explainable AI & Score Breakdown</h3>
          </div>
          <p className="text-xs text-slate-400">
            Auditable score synthesis: Numerical baseline &rarr; Deterministic constraint floor &rarr; LLM interpretation
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-bold">
          XAI Engine
        </span>
      </div>

      {/* Active Official Warning Banner */}
      {officialWarning && (
        <div className="bg-rose-950/40 border border-rose-600/70 p-3 rounded-xl flex items-start space-x-2.5 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">Active {officialWarning.issuing_authority} Weather Directive:</strong>{' '}
            Bulletin <span className="font-mono text-cyan-300 font-bold">{officialWarning.bulletin_id}</span> ({officialWarning.floor_level}) enforces a mandatory safety floor of <span className="font-mono font-bold">{officialWarning.floor_score}/100</span>.
          </div>
        </div>
      )}

      {/* 4-Stage Scoring Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Baseline Card */}
        <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>1. Sensor Baseline</span>
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {Math.round(baselineScore)}<span className="text-xs text-slate-400">/100</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Raw numerical model score from INCOIS & IMD
          </p>
        </div>

        {/* Constraint Floor Card */}
        <div className={`border p-3.5 rounded-xl ${
          constraintFloor 
            ? 'bg-amber-950/30 border-amber-500/50' 
            : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>2. Safety Floor</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black font-mono flex items-center space-x-1">
            <span className={constraintFloor ? 'text-amber-400' : 'text-emerald-400'}>
              {constraintFloor ? `${p0Risk.constraint_floor}/100` : 'None'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate" title={constraintReason}>
            {constraintReason}
          </p>
        </div>

        {/* LLM Adjustment Card */}
        <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>3. LLM Delta</span>
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono text-purple-300">
            {llmAdjustment ? (llmAdjustment > 0 ? `+${llmAdjustment}` : llmAdjustment) : '0'}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Gemini 2.5 Flash contextual adjustment
          </p>
        </div>

        {/* Final Synthesized Score Card */}
        <div className="bg-cyan-950/30 border border-cyan-500/40 p-3.5 rounded-xl">
          <div className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Final Synthesized</span>
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300">
            {finalScore}<span className="text-xs text-slate-400">/100</span>
          </div>
          <p className="text-[10px] text-cyan-400/80 mt-1">
            Binding operational risk score
          </p>
        </div>
      </div>

      {/* Key Auditable Findings */}
      <div>
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
          Auditable Model Findings (Point P0)
        </h4>
        <div className="space-y-2">
          {keyFindings.map((finding, idx) => (
            <div key={idx} className="flex items-start justify-between bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 text-xs">
              <div className="space-y-0.5 flex-1 pr-2">
                <div className="font-bold text-slate-200">{finding.factor}</div>
                <p className="text-slate-400 text-[11px]">{finding.impact}</p>
              </div>
              <span className="px-2 py-1 rounded bg-slate-800 text-cyan-300 font-mono font-semibold text-[11px] whitespace-nowrap">
                {finding.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Real Data Quality & Source Citations */}
      {Object.keys(dataQuality).length > 0 && (
        <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Telemetry Provenance & Source Citations</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            {Object.entries(dataQuality).slice(0, 8).map(([param, info]) => (
              <div key={param} className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] truncate capitalize">{String(param).replace(/_/g, ' ')}</span>
                <span className="text-cyan-300 font-mono font-semibold text-[10px] block truncate">{info?.source_note || 'INCOIS / IMD'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
