import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XOctagon, 
  AlertOctagon, 
  Volume2, 
  VolumeX, 
  FileText, 
  Wind, 
  Waves, 
  Eye, 
  Compass, 
  ShieldCheck 
} from 'lucide-react';
import { speakText, stopSpeaking } from '../utils/speech';

export default function DecisionHero({ analysis, onOpenReport, language = 'en' }) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  if (!analysis) return null;

  const decision = analysis.decision || {};
  const risk = analysis.risk || {};
  const plan = analysis.plan || {};
  const explainability = analysis.explainability || {};

  // Extract summary point (worst or P0 or preferred)
  const p0 = analysis.points?.find(p => p.point_id === 'P0') || analysis.points?.[0] || {};
  const p0Risk = p0.risk || {};
  const p0Summary = decision.point_summaries?.find(p => p.point_id === 'P0') || decision.point_summaries?.[0] || p0Risk;

  const rawLevel = decision.safety_category || decision.category || p0Risk.risk_level || p0Summary.risk_level || 
                   (decision.recommendation_type === 'not_recommended' ? 'UNSAFE' : 'SAFE');
  const category = (rawLevel || 'SAFE').toUpperCase();
  const score = Math.round(decision.overall_risk_score ?? p0Risk.final_score ?? decision.risk_score ?? p0Summary.final_score ?? risk.overall_risk_score ?? 25);
  
  const advice = decision.one_line_recommendation || 
                 decision.primary_advice || 
                 decision.detailed_recommendation || 
                 p0Risk.reasoning || 
                 p0Summary.reasoning || 
                 decision.preferred_point_reason || 
                 'Proceed according to standard maritime safety procedures.';

  // Build list of actionable recommendations
  let recommendations = [];
  if (Array.isArray(decision.recommendations) && decision.recommendations.length > 0) {
    recommendations = decision.recommendations;
  } else if (Array.isArray(p0Risk.key_findings) && p0Risk.key_findings.length > 0) {
    recommendations = p0Risk.key_findings;
  } else if (Array.isArray(p0Summary.key_findings) && p0Summary.key_findings.length > 0) {
    recommendations = p0Summary.key_findings;
  } else if (decision.key_findings) {
    if (Array.isArray(decision.key_findings.additional_findings)) {
      recommendations = decision.key_findings.additional_findings;
    } else if (typeof decision.key_findings === 'object') {
      recommendations = Object.entries(decision.key_findings)
        .filter(([_, v]) => typeof v === 'string' && v.trim())
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
    }
  }

  const safeWindows = decision.safe_windows || [];
  const safeHarbors = decision.safe_harbor_recommendations || ['Kochi Fisheries Harbor', 'Thoppumpady Safe Haven'];

  // Config based on traffic light
  const config = {
    SAFE: {
      bg: 'from-emerald-950/80 via-emerald-900/40 to-slate-900/90',
      border: 'border-emerald-500/50',
      badgeBg: 'bg-emerald-500 text-slate-950',
      ringColor: '#10b981',
      title: 'SAFE TO SAIL',
      titleLocal: 'समुद्र यात्रा सुरक्षित है',
      icon: CheckCircle2,
      textColor: 'text-emerald-400',
    },
    CAUTION: {
      bg: 'from-amber-950/80 via-amber-900/40 to-slate-900/90',
      border: 'border-amber-500/50',
      badgeBg: 'bg-amber-400 text-slate-950',
      ringColor: '#f59e0b',
      title: 'PROCEED WITH CAUTION',
      titleLocal: 'सावधानी से आगे बढ़ें',
      icon: AlertTriangle,
      textColor: 'text-amber-400',
    },
    UNSAFE: {
      bg: 'from-rose-950/80 via-rose-900/40 to-slate-900/90',
      border: 'border-rose-500/50',
      badgeBg: 'bg-rose-500 text-white',
      ringColor: '#f43f5e',
      title: 'DO NOT SAIL / RETREAT',
      titleLocal: 'समुद्र में न जाएं / वापस लौटें',
      icon: XOctagon,
      textColor: 'text-rose-400',
    },
    DANGEROUS: {
      bg: 'from-red-950 via-rose-950/60 to-slate-900/90',
      border: 'border-red-600',
      badgeBg: 'bg-red-600 text-white animate-pulse',
      ringColor: '#dc2626',
      title: 'CRITICAL MARITIME DANGER',
      titleLocal: 'गंभीर समुद्री खतरा',
      icon: AlertOctagon,
      textColor: 'text-red-400',
    },
  }[category] || {
    bg: 'from-blue-950/80 to-slate-900/90',
    border: 'border-blue-500/50',
    badgeBg: 'bg-blue-500 text-white',
    ringColor: '#3b82f6',
    title: 'CONDITIONS ASSESSED',
    titleLocal: 'स्थिति का मूल्यांकन',
    icon: CheckCircle2,
    textColor: 'text-blue-400',
  };

  const Icon = config.icon;

  const handleAudioPlayback = () => {
    if (isPlayingAudio) {
      stopSpeaking();
      setIsPlayingAudio(false);
    } else {
      const textToRead = `${config.title}. ${advice}. ${recommendations.slice(0, 2).join('. ')}`;
      speakText(textToRead, language);
      setIsPlayingAudio(true);
      // Auto reset after rough reading time
      const estimatedDuration = Math.max(3000, textToRead.length * 70);
      setTimeout(() => setIsPlayingAudio(false), estimatedDuration);
    }
  };

  return (
    <div className={`rounded-2xl border ${config.border} bg-gradient-to-br ${config.bg} p-5 sm:p-7 shadow-2xl backdrop-blur-md`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Left: Traffic light badge & Main Advice */}
        <div className="space-y-4 flex-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className={`px-4 py-1.5 rounded-full text-sm font-extrabold flex items-center space-x-2 shadow-lg tracking-wide uppercase ${config.badgeBg}`}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{config.title}</span>
            </div>

            <div className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300">
              Vessel: <span className="text-cyan-400 font-bold capitalize">{plan.vessel_type || 'Motorized Craft'}</span>
            </div>

            <div className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300">
              Activity: <span className="text-cyan-400 font-bold capitalize">{plan.activity || 'Fishing'}</span>
            </div>
          </div>

          {/* Section 77: Large High-Contrast Headline Advice */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
              {advice}
            </h2>
            {language !== 'en' && (
              <p className="text-sm font-medium text-slate-300 mt-1">
                {config.titleLocal}
              </p>
            )}
          </div>

          {/* Action Buttons: Listen & Advisory Report */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Audio Listen Button */}
            <button
              onClick={handleAudioPlayback}
              className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-md ${
                isPlayingAudio
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 animate-pulse'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
              }`}
            >
              {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isPlayingAudio ? 'Stop Audio' : 'Listen / सुनें / கேளுங்கள்'}</span>
            </button>

            {/* Official Report Button */}
            <button
              onClick={onOpenReport}
              className="px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center space-x-2 transition-all"
            >
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Advisory Bulletin</span>
            </button>
          </div>
        </div>

        {/* Right: Score Gauge & Key Metrics */}
        <div className="flex items-center space-x-6 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          {/* Circular Score Ring */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="#1e293b"
                strokeWidth="10"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke={config.ringColor}
                strokeWidth="10"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * Math.min(100, Math.max(0, score))) / 100}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className={`text-2xl sm:text-3xl font-black ${config.textColor}`}>
                {score}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Risk Score
              </span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-slate-300">
              <Waves className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>Wave Status: <b className="text-white">{(p0Risk.risk_factors || p0Summary.risk_factors || []).includes('wave_height_m') ? 'High / Rough' : 'Inspected'}</b></span>
            </div>
            <div className="flex items-center space-x-2 text-slate-300">
              <Wind className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>Wind Status: <b className="text-white">{(p0Risk.risk_factors || p0Summary.risk_factors || []).some(f => f.includes('wind')) ? 'Hazardous Gusts' : 'Favorable'}</b></span>
            </div>
            <div className="flex items-center space-x-2 text-slate-300">
              <Compass className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>Safe Quadrant: <b className="text-cyan-300 font-bold">{decision.preferred_point || 'P0'}</b></span>
            </div>
          </div>
        </div>

      </div>

      {/* Actionable Recommendations List */}
      {recommendations.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Operational Safety Directives</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start space-x-2 text-xs text-slate-200 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                <span className="text-cyan-400 font-bold">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safe Harbors recommendation */}
      {safeHarbors.length > 0 && (
        <div className="mt-3 text-xs text-slate-300 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 flex items-center space-x-2">
          <Compass className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Recommended Safe Harbors in emergency: <strong className="text-emerald-300">{safeHarbors.join(', ')}</strong></span>
        </div>
      )}
    </div>
  );
}
