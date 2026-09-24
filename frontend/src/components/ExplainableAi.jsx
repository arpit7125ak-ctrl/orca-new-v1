/**
 * ============================================================================
 * ORCA Explainable AI (XAI) & Score Decomposition (src/components/ExplainableAi.jsx)
 * ============================================================================
 * Visualizes the audited mathematical risk score formulation (Section 78).
 * 
 * Architectural Compliance (Architecture Spec §78):
 * 1. Score Decomposition: Displays the exact mathematical transition from
 *    Deterministic Baseline Score -> LLM Calibration Adjustment (bounded [-15, +15]) -> Final Score.
 * 2. Mandatory Constraint Floors: Explains when official IMD/INCOIS cyclone warnings
 *    or maritime hazard bulletins legally override LLM adjustments to enforce a risk floor (e.g. >= 80).
 * 3. 7-Dimension Factor Breakdown: Wind, waves, tides, visibility, restricted zones, etc.
 * 4. Data Quality & Source Provenance: Shows latency, freshness, and authority per measurement.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Scale, 
  Cpu, 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  Database 
} from 'lucide-react';

/**
 * Explainable AI Component.
 * 
 * @param {Object} props
 * @param {Object|null} props.analysis - Completed analysis result containing explainability and risk models.
 */
export default function ExplainableAi({ analysis }) {
  const { t } = useTranslation('ui');
  if (!analysis) return null;

  const explainability = analysis.explainability || {};
  const risk = analysis.risk || {};
  const decision = analysis.decision || {};
  const p0 = analysis.points?.find(p => p.point_id === 'P0') || analysis.points?.[0] || {};
  const p0Risk = p0.risk || decision.point_summaries?.[0] || {};
  const displayPointId = p0.point_id || 'P0';

  const rawBaseline = explainability.baseline_score ?? p0Risk.baseline_score ?? null;
  const llmAdjustment = explainability.llm_adjustment ?? p0Risk.llm_adjustment ?? null;
  const constraintFloor = p0Risk.constraint_floor !== null && p0Risk.constraint_floor !== undefined;
  const officialWarning = Array.isArray(p0Risk.official_warnings) && p0Risk.official_warnings.length > 0 ? p0Risk.official_warnings[0] : null;
  const warningAuthority = officialWarning?.issuing_authority || officialWarning?.source || t('xai.officialAuthority', 'Official Maritime Authority');
  const warningBulletin = officialWarning?.bulletin_id || officialWarning?.warning_id || officialWarning?.title || t('xai.activeBulletin', 'Active Marine Advisory');

  const constraintReason = officialWarning
    ? t('xai.enforcedWarningReason', {
        authority: warningAuthority,
        type: officialWarning.warning_type || 'warning',
        bulletin: warningBulletin,
        score: officialWarning.floor_score,
      })
    : explainability.constraint_floor_reason || t('xai.noOverrideReason');
  
  const rawFinal = p0Risk.final_score ?? decision.overall_risk_score ?? null;
  const finalScore = rawFinal !== null ? Math.round(rawFinal) : null;

  // Real dimension scores if available
  const dimensionScores = explainability.dimension_scores || null;

  const rawFindings = p0Risk.key_findings || explainability.key_findings || decision.key_findings;
  const keyFindings = Array.isArray(rawFindings) && rawFindings.length > 0
    ? (typeof rawFindings[0] === 'string'
        ? rawFindings.map((f, i) => ({ factor: `${t('xai.safetyFactorPrefix')} 0${i+1}`, value: t('results.evaluated'), impact: f }))
        : rawFindings)
    : [];

  const dataQuality = (p0Risk.data_quality && typeof p0Risk.data_quality === 'object' && Object.keys(p0Risk.data_quality).length > 0)
    ? p0Risk.data_quality
    : ((analysis.data_quality && typeof analysis.data_quality === 'object') ? analysis.data_quality : {});

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Scale className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">{t('xai.title')}</h3>
          </div>
          <p className="text-xs text-slate-400">
            {t('xai.subtitle')}
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-bold">
          {t('xai.badge')}
        </span>
      </div>

      {/* Active Official Warning Banner */}
      {officialWarning && (
        <div className="bg-rose-950/40 border border-rose-600/70 p-3 rounded-xl flex items-start space-x-2.5 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">{t('xai.activeWarningTitle', { authority: warningAuthority })}:</strong>{' '}
            {t('xai.warningMandatoryFloor', {
              bulletin: warningBulletin,
              level: officialWarning.floor_level || 'WARNING',
              score: officialWarning.floor_score ?? 65,
            })}
          </div>
        </div>
      )}

      {/* 4-Stage Scoring Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Baseline Card */}
        <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{t('xai.card1Baseline')}</span>
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {rawBaseline !== null ? (
              <>
                {Math.round(rawBaseline)}<span className="text-xs text-slate-400">/100</span>
              </>
            ) : (
              <span className="text-sm text-slate-500 font-normal">{t('pointDetail.unavailable')}</span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {t('xai.card1Desc')}
          </p>
        </div>

        {/* Constraint Floor Card */}
        <div className={`border p-3.5 rounded-xl ${
          constraintFloor 
            ? 'bg-amber-950/30 border-amber-500/50' 
            : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{t('xai.card2Floor')}</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black font-mono flex items-center space-x-1">
            <span className={constraintFloor ? 'text-amber-400' : 'text-emerald-400'}>
              {constraintFloor ? `${p0Risk.constraint_floor}/100` : t('xai.none')}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate" title={constraintReason}>
            {constraintReason}
          </p>
        </div>

        {/* LLM Adjustment Card */}
        <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{t('xai.card3Delta')}</span>
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono text-purple-300">
            {llmAdjustment !== null ? (
              llmAdjustment > 0 ? `+${llmAdjustment}` : `${llmAdjustment}`
            ) : (
              '0'
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {t('xai.card3Desc')}
          </p>
        </div>

        {/* Final Synthesized Score Card */}
        <div className="bg-cyan-950/30 border border-cyan-500/40 p-3.5 rounded-xl">
          <div className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{t('xai.card4Final')}</span>
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300">
            {finalScore !== null ? (
              <>
                {finalScore}<span className="text-xs text-slate-400">/100</span>
              </>
            ) : (
              <span className="text-sm text-slate-500 font-normal">{t('pointDetail.unavailable')}</span>
            )}
          </div>
          <p className="text-[10px] text-cyan-400/80 mt-1">
            {t('xai.card4Desc')}
          </p>
        </div>
      </div>

      {/* Dimension breakdown if provided by model */}
      {dimensionScores && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(dimensionScores).map(([dim, val]) => (
            <div key={dim} className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block capitalize truncate">
                {dim.replace(/_/g, ' ')}
              </span>
              <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                {val !== null && val !== undefined ? `${val}/100` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Key Auditable Findings */}
      <div>
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
          {t('xai.auditableFindingsTitle', { pointId: displayPointId })}
        </h4>
        {keyFindings.length > 0 ? (
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
        ) : (
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-500 text-xs text-center">
            {t('xai.noHighlights')}
          </div>
        )}
      </div>

      {/* Real Data Quality & Source Citations */}
      {Object.keys(dataQuality).length > 0 && (
        <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t('xai.telemetryProvenanceTitle')}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            {Object.entries(dataQuality).slice(0, 8).map(([param, info]) => (
              <div key={param} className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] truncate capitalize">{String(param).replace(/_/g, ' ')}</span>
                <span className="text-cyan-300 font-mono font-semibold text-[10px] block truncate">{info?.source_note || t('xai.provenanceUnavailable')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
