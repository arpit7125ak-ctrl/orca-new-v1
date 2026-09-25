/**
 * ============================================================================
 * ORCA Visible Multi-Agent Reasoning Component (src/components/AgenticReasoning.jsx)
 * ============================================================================
 * Visualizes the complete autonomous agent pipeline execution trace (Section 79).
 * 
 * Architectural Compliance (Architecture Spec §79):
 * 1. Intent & Language Diagnostics: Displays detected intent, language, and confidence score.
 * 2. Specialist Selection Policy: Shows why specific agents (weather, ocean, tide, etc.) were
 *    activated by policy or mandatory rules.
 * 3. Execution Trace & Timing: Lists every completed pipeline stage with its exact
 *    wall-clock latency (duration_ms).
 * 4. Concurrent Pipeline Latency: Calculates wall-clock elapsed duration across concurrent
 *    fan-out agents (Math.max(ends) - Math.min(starts)) rather than a misleading sequential sum.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle2, 
  Clock, 
  Workflow
} from 'lucide-react';

/**
 * Agentic Reasoning & Execution Trace Component.
 * 
 * @param {Object} props
 * @param {Object|null} props.analysis - Completed analysis payload containing plan and execution_trace.
 */
export default function AgenticReasoning({ analysis }) {
  const [expanded, setExpanded] = useState(false);

  const { t } = useTranslation('ui');
  if (!analysis) return null;

  const plan = analysis.plan || {};
  const intent = plan.primary_intent || 'point_safety';
  const detectedLanguage = plan.language_detection?.detected_language || 'en';
  const confidence = Math.round((plan.language_detection?.detection_confidence || 1) * 100);

  // Real selected agents from plan (may be objects [{agent, reason}] or strings)
  const rawAgents = Array.isArray(plan.selected_agents) ? plan.selected_agents : [];
  const selectedAgentsList = rawAgents.map((a) => {
    if (typeof a === 'string') {
      return { agent: a, reason: null };
    }
    return {
      agent: a?.agent || 'specialist',
      reason: a?.reason || (a?.mandatory_by_policy ? t('reasoning.mandatoryPolicy') : null),
    };
  });

  const agentDescriptions = {
    backend_validation: t('reasoning.descBackendValidation'),
    ai_service_handoff: t('reasoning.descAiHandoff', 'AI Service handoff & dispatch'),
    planner: t('reasoning.descPlanner'),
    weather: t('reasoning.descWeather'),
    ocean: t('reasoning.descOcean'),
    tide: t('reasoning.descTide'),
    cyclone: t('reasoning.descCyclone'),
    ecosystem: t('reasoning.descEcosystem'),
    gis: t('reasoning.descGis'),
    pfz: t('reasoning.descPfz'),
    risk: t('reasoning.descRisk'),
    decision: t('reasoning.descDecision'),
  };

  // Real execution trace from backend
  const rawTrace = Array.isArray(analysis.execution_trace) ? analysis.execution_trace : [];
  const trace = rawTrace.map((tr) => {
    const agent = tr.agent || tr.stage;
    return {
      agent,
      step: tr.selection_reason || agentDescriptions[agent] || (agent ? `${t('reasoning.specialistPrefix', 'Specialist')}: ${agent}` : t('reasoning.pipelineStep', 'Pipeline Step')),
      duration_ms: (typeof tr.duration_ms === 'number' && !isNaN(tr.duration_ms)) ? tr.duration_ms : null,
      status: tr.status || 'completed',
      timestamp: tr.completed_at ? new Date(tr.completed_at).toLocaleTimeString() : null,
    };
  });

  const totalDuration = (() => {
    // True end-to-end latency: earliest started_at to latest completed_at
    // across the entire trace. This reflects wall-clock pipeline time rather
    // than summing sequential durations (which excluded parallel agents).
    const starts = rawTrace
      .map((tr) => tr.started_at ? new Date(tr.started_at).getTime() : null)
      .filter((v) => v !== null && !isNaN(v));
    const ends = rawTrace
      .map((tr) => tr.completed_at ? new Date(tr.completed_at).getTime() : null)
      .filter((v) => v !== null && !isNaN(v));
    if (starts.length > 0 && ends.length > 0) {
      return Math.max(...ends) - Math.min(...starts);
    }
    // Fallback: sum individual durations
    return trace.reduce((acc, curr) => acc + (curr.duration_ms || 0), 0);
  })();
  const samplingMode = plan.sampling?.mode || plan.sampling_mode || '9-Point Local Grid';

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Workflow className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">{t('reasoning.title')}</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            {t('reasoning.subtitle')}
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-[var(--accent-primary)] bg-purple-950/60 px-2.5 py-1 rounded-full border border-[var(--accent-primary)]">
          <Clock className="w-3.5 h-3.5" />
          <span>{t('reasoning.pipelineLatency', { ms: totalDuration })}</span>
        </div>
      </div>

      {/* Orchestrator Plan Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[var(--bg-base)] p-3.5 rounded-xl border border-[var(--border-base)]">
        <div>
          <span className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold block">{t('reasoning.missionIntent')}</span>
          <span className="text-xs font-bold text-[var(--accent-primary)] capitalize">{String(intent).replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold block">{t('reasoning.languageDetection')}</span>
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase">{detectedLanguage} ({confidence}% {t('reasoning.confidence')})</span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold block">{t('reasoning.gridSamplingMode')}</span>
          <span className="text-xs font-bold text-[var(--accent-primary)] capitalize">{String(samplingMode).replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Activated Specialist Agents */}
      <div>
        <h4 className="text-xs font-bold text-[var(--safe-bright)] uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{t('reasoning.activatedAgents', { count: selectedAgentsList.length })}</span>
        </h4>
        {selectedAgentsList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {selectedAgentsList.map((item, idx) => {
              const agentName = item.agent;
              const description = agentDescriptions[agentName] || item.reason || t('reasoning.defaultSpecialistDesc');
              return (
                <div key={idx} className="bg-[var(--bg-base)] border border-emerald-900/30 p-2.5 rounded-xl text-xs space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[var(--safe-bright)] capitalize">{String(agentName).replace(/_/g, ' ')} {t('reasoning.agentSuffix')}</span>
                    <span className="text-[9px] font-semibold bg-[var(--safe)]/20 text-[var(--safe-bright)] px-1.5 py-0.2 rounded border border-[var(--safe)]">
                      {t('reasoning.executed')}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] truncate" title={description}>{description}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3 bg-[var(--bg-base)] rounded-xl border border-[var(--border-base)] text-[var(--text-muted)] text-xs text-center">
            {t('reasoning.noAgentsSelected', 'No specialist agents required for this query.')}
          </div>
        )}
      </div>

      {/* Real Execution Trace Log */}
      <div className="bg-[var(--bg-base)] p-4 rounded-xl border border-[var(--border-base)]">
        <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center space-x-1.5">
          <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{t('reasoning.chronologicalTrace')}</span>
        </h4>
        {trace.length > 0 ? (
          <div className="space-y-2">
            {trace.map((step, idx) => {
              const isCompleted = step.status === 'completed' || step.status === 200 || step.status === 202;
              const isFailed = step.status === 'failed' || step.status === 'error';
              const dotColor = isCompleted ? 'bg-[var(--safe)]' : isFailed ? 'bg-[var(--dangerous)]' : 'bg-[var(--caution)]';
              const durationLabel = step.duration_ms !== null 
                ? (step.duration_ms >= 1000 ? `${(step.duration_ms / 1000).toFixed(2)}s` : `${step.duration_ms}ms`)
                : '—';

              return (
                <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-base)]">
                  <div className="flex items-center space-x-2 truncate mr-2">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="font-medium text-[var(--text-primary)] truncate">{step.step}</span>
                    <span className="text-[10px] font-mono text-cyan-400/80 hidden sm:inline">({step.agent})</span>
                  </div>
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">{durationLabel}</span>
                    <span className={`w-2 h-2 rounded-full ${dotColor}`} title={step.status} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3 bg-[var(--bg-base)] rounded-xl border border-[var(--border-base)] text-[var(--text-muted)] text-xs text-center">
            {t('reasoning.traceNotAvailable', 'Execution trace not recorded for this analysis.')}
          </div>
        )}
      </div>
    </div>
  );
}
