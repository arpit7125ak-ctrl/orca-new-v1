import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { orcaApi } from '../api/client';
import { haversineDistanceKm } from '../utils/geo';

export default function DecisionHero({ analysis, onOpenReport, language = 'en' }) {
  const { t } = useTranslation('ui');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  if (!analysis) return null;

  const decision = analysis.decision || {};
  const risk = analysis.risk || {};
  const plan = analysis.plan || {};
  const explainability = analysis.explainability || {};

  // Extract the target summary point for Hero telemetry & Quick Metrics.
  // CRITICAL RULE: For multi-point analyses (9-point grid or 25-point regional scan),
  // this MUST pull from decision.preferred_point (the safest/recommended point).
  // Only if no preferred_point is designated does it fall back to 'P0', first applicable sea point, or points[0].
  const summaryPoint = (decision.preferred_point ? analysis.points?.find(p => p.point_id === decision.preferred_point) : null) ||
                       analysis.points?.find(p => p.point_id === 'P0') || 
                       analysis.points?.find(p => p.point_status === 'applicable') || 
                       analysis.points?.[0] || {};
  const p0 = summaryPoint;
  const p0Risk = summaryPoint.risk || {};
  const p0Summary = decision.point_summaries?.find(p => p.point_id === summaryPoint.point_id) || 
                    decision.point_summaries?.find(p => p.point_id === 'P0') || 
                    decision.point_summaries?.[0] || 
                    p0Risk;

  const recType = String(decision.recommendation_type || '').toLowerCase();
  let fallbackFromRec = null;
  if (recType.includes('danger') || recType === 'return_immediately') {
    fallbackFromRec = 'DANGEROUS';
  } else if (recType.includes('not') || recType.includes('do_not') || recType.includes('no_go') || recType === 'do_not_venture') {
    fallbackFromRec = 'UNSAFE';
  } else if (recType.includes('caution')) {
    fallbackFromRec = 'CAUTION';
  } else if (recType.includes('safe') || recType === 'proceed_with_caution') {
    fallbackFromRec = recType.includes('caution') ? 'CAUTION' : 'SAFE';
  }

  const rawLevel = decision.safety_category || decision.category || p0Risk.risk_level || p0Summary.risk_level || fallbackFromRec;
  const category = (rawLevel || 'UNAVAILABLE').toUpperCase();

  const rawScore = decision.overall_risk_score ?? p0Risk.final_score ?? decision.risk_score ?? p0Summary.final_score ?? risk.overall_risk_score;
  const hasScore = rawScore !== null && rawScore !== undefined && !isNaN(Number(rawScore));
  const score = hasScore ? Math.round(Number(rawScore)) : null;
  
  const advice = analysis.quick_information_result?.answer_text ||
                 decision.one_line_recommendation || 
                 decision.primary_advice || 
                 decision.detailed_recommendation || 
                 p0Risk.reasoning || 
                 p0Summary.reasoning || 
                 decision.preferred_point_reason || 
                 t('hero.noRecommendations');

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
  const [safeHarbors, setSafeHarbors] = useState(
    Array.isArray(decision.safe_harbor_recommendations) ? decision.safe_harbor_recommendations : []
  );

  useEffect(() => {
    if (Array.isArray(decision.safe_harbor_recommendations) && decision.safe_harbor_recommendations.length > 0) {
      setSafeHarbors(decision.safe_harbor_recommendations);
      return;
    }

    const lat = plan.location?.validated?.lat ?? plan.location?.original?.lat ?? p0.lat;
    const lon = plan.location?.validated?.lon ?? plan.location?.original?.lon ?? p0.lon;
    if (lat == null || lon == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      setSafeHarbors([]);
      return;
    }

    let active = true;
    orcaApi.getMapLayers()
      .then((data) => {
        if (!active) return;
        const layers = (data && Array.isArray(data.layers)) ? data.layers : [];
        const shelterPorts = layers.filter(
          (l) => l.layer_type === 'port' && l.properties?.shelter_suitable && Array.isArray(l.geometry?.coordinates) && l.geometry.coordinates.length >= 2
        );
        const MAX_RADIUS_KM = 150;
        const nearest = shelterPorts
          .map((p) => {
            const [pLon, pLat] = p.geometry.coordinates;
            return {
              name: p.layer_name,
              dist: haversineDistanceKm(Number(lat), Number(lon), Number(pLat), Number(pLon)),
            };
          })
          .filter((p) => p.dist <= MAX_RADIUS_KM)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 2);

        setSafeHarbors(nearest.map((p) => p.name));
      })
      .catch((err) => {
        console.warn('Failed to load emergency shelters:', err);
        if (active) setSafeHarbors([]);
      });

    return () => { active = false; };
  }, [decision.safe_harbor_recommendations, plan.location, p0.lat, p0.lon]);

  // Config based on traffic light
  const config = {
    SAFE: {
      bg: 'from-emerald-950/80 via-emerald-900/40 to-slate-900/90',
      border: 'border-emerald-500/50',
      badgeBg: 'bg-emerald-500 text-slate-950',
      ringColor: '#10b981',
      title: t('hero.safeToSail'),
      titleLocal: t('hero.safeToSail', { lng: language }),
      icon: CheckCircle2,
      textColor: 'text-emerald-400',
    },
    CAUTION: {
      bg: 'from-amber-950/80 via-amber-900/40 to-slate-900/90',
      border: 'border-amber-500/50',
      badgeBg: 'bg-amber-400 text-slate-950',
      ringColor: '#f59e0b',
      title: t('hero.proceedWithCaution'),
      titleLocal: t('hero.proceedWithCaution', { lng: language }),
      icon: AlertTriangle,
      textColor: 'text-amber-400',
    },
    UNSAFE: {
      bg: 'from-rose-950/80 via-rose-900/40 to-slate-900/90',
      border: 'border-rose-500/50',
      badgeBg: 'bg-rose-500 text-white',
      ringColor: '#f43f5e',
      title: t('hero.doNotSail'),
      titleLocal: t('hero.doNotSail', { lng: language }),
      icon: XOctagon,
      textColor: 'text-rose-400',
    },
    DANGEROUS: {
      bg: 'from-red-950 via-rose-950/60 to-slate-900/90',
      border: 'border-red-600',
      badgeBg: 'bg-red-600 text-white animate-pulse',
      ringColor: '#dc2626',
      title: t('hero.criticalDanger'),
      titleLocal: t('hero.criticalDanger', { lng: language }),
      icon: AlertOctagon,
      textColor: 'text-red-400',
    },
  }[category] || {
    bg: 'from-slate-900 via-slate-950 to-slate-900',
    border: 'border-slate-700/60',
    badgeBg: 'bg-slate-700 text-slate-200',
    ringColor: '#64748b',
    title: t('hero.assessmentUnavailable'),
    titleLocal: t('hero.assessmentUnavailable', { lng: language }),
    icon: AlertTriangle,
    textColor: 'text-slate-400',
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
              {t('hero.vesselLabel')}: <span className="text-cyan-400 font-bold capitalize">{plan.vessel_type ? t(`vessels.${plan.vessel_type}`, { defaultValue: plan.vessel_type.replace(/_/g, ' ') }) : t('hero.defaultVessel')}</span>
            </div>

            <div className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300">
              {t('hero.activityLabel')}: <span className="text-cyan-400 font-bold capitalize">{plan.activity ? t(`activities.${plan.activity}`, { defaultValue: plan.activity.replace(/_/g, ' ') }) : t('hero.defaultActivity')}</span>
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
              <span>{isPlayingAudio ? t('hero.stopAudio') : t('hero.playAudio')}</span>
            </button>

            {/* Official Report Button */}
            <button
              onClick={onOpenReport}
              className="px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center space-x-2 transition-all"
            >
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>{t('results.advisoryBulletin')}</span>
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
                strokeDashoffset={hasScore ? 264 - (264 * Math.min(100, Math.max(0, score))) / 100 : 264}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className={`text-2xl sm:text-3xl font-black ${config.textColor}`}>
                {hasScore ? score : '--'}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('hero.riskScore')}
              </span>
            </div>
          </div>

          {/* Quick Metrics — real numeric values from summaryPoint.measurements when available */}
          {(() => {
            const meas = summaryPoint.measurements || {};
            const waveM  = meas.wave_height_m;
            const periodM = meas.wave_period_s;
            const windM  = meas.wind_speed_ms;
            const gustM  = meas.wind_gust_ms;
            const riskFactors = p0Risk.risk_factors || p0Summary.risk_factors || [];

            const waveVal = waveM?.value !== null && waveM?.value !== undefined ? `${waveM.value} m` : null;
            const periodVal = periodM?.value !== null && periodM?.value !== undefined ? `${periodM.value} s` : null;
            const windVal = windM?.value !== null && windM?.value !== undefined ? `${windM.value} m/s` : null;
            const gustVal = gustM?.value !== null && gustM?.value !== undefined ? `${gustM.value} m/s` : null;

            const waveIsHazard = riskFactors.includes('wave_height_m');
            const windIsHazard = riskFactors.some(f => f.includes('wind'));

            return (
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Waves className={`w-4 h-4 flex-shrink-0 ${waveIsHazard ? 'text-amber-400' : 'text-cyan-400'}`} />
                  {waveVal ? (
                    <span>
                      {t('hero.waveStatus')}: <b className={waveIsHazard ? 'text-amber-300' : 'text-white'}>{waveVal}</b>
                      {periodVal && <span className="text-slate-500"> · {periodVal}</span>}
                    </span>
                  ) : (
                    <span>{t('hero.waveStatus')}: <b className="text-white">{waveIsHazard ? t('hero.highRough') : t('hero.inspected')}</b></span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-slate-300">
                  <Wind className={`w-4 h-4 flex-shrink-0 ${windIsHazard ? 'text-amber-400' : 'text-cyan-400'}`} />
                  {windVal ? (
                    <span>
                      {t('hero.windStatus')}: <b className={windIsHazard ? 'text-amber-300' : 'text-white'}>{windVal}</b>
                      {gustVal && <span className="text-slate-500"> (gust {gustVal})</span>}
                    </span>
                  ) : (
                    <span>{t('hero.windStatus')}: <b className="text-white">{windIsHazard ? t('hero.hazardousGusts') : t('hero.favorable')}</b></span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-slate-300">
                  <Compass className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>{t('hero.safeQuadrant')}: <b className="text-cyan-300 font-bold">{decision.preferred_point || (status === 'DANGEROUS' ? t('hero.noneStayInPort', 'None (Stay in Port)') : t('pointDetail.unavailable', 'N/A'))}</b></span>
                </div>
              </div>
            );
          })()}
        </div>

      </div>

      {/* Actionable Recommendations List */}
      {recommendations.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t('hero.operationalDirectives')}</span>
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
          <span>{t('hero.recommendedSafeHarbors')}: <strong className="text-emerald-300">{safeHarbors.join(', ')}</strong></span>
        </div>
      )}
    </div>
  );
}
