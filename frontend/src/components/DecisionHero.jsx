/**
 * ============================================================================
 * ORCA Decision Hero Component (src/components/DecisionHero.jsx)
 * ============================================================================
 * Top-level executive safety card presenting unambiguous operational advice.
 * 
 * Architectural Compliance (Architecture Spec §7, §77):
 * 1. Prominent Safety Level: High-contrast badge for SAFE (emerald), CAUTION (amber),
 *    UNSAFE (orange), or DANGEROUS (rose).
 * 2. Primary One-Line Operational Advisory: Plain, actionable guidance a fisherman
 *    can act on immediately without deciphering numbers.
 * 3. Audio Read-Aloud: One-click Web Speech TTS in the detected local language.
 * 4. Quick Metrics: Live wind speed, significant wave height, and visibility metrics
 *    specifically targeting decision.preferred_point (the recommended sea location).
 * 5. Official Warning Alerts: Enforced banners when IMD/INCOIS bulletins are active.
 */

import React, { useState, useEffect, useRef } from 'react';
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
  ShieldCheck,
  Clock 
} from 'lucide-react';
import { speakText, stopSpeaking } from '../utils/speech';
import { orcaApi } from '../api/client';
import { haversineDistanceKm } from '../utils/geo';

/**
 * Decision Hero Card Component.
 * 
 * @param {Object} props
 * @param {Object|null} props.analysis - Completed analysis result object.
 * @param {Function} props.onOpenReport - Callback to open the full advisory report modal.
 * @param {string} [props.language='en'] - Target language for text-to-speech audio synthesis.
 */
export default function DecisionHero({ analysis, onOpenReport, language = 'en' }) {
  const { t } = useTranslation('ui');
  // State for voice read-aloud active status
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
      bg: 'from-[var(--safe)]/20 to-[var(--bg-surface)]',
      border: 'border-[var(--safe)]/50',
      badgeBg: 'bg-[var(--safe)] text-white',
      ringColor: '#4ade80',
      title: t('hero.safeToSail'),
      titleLocal: t('hero.safeToSail', { lng: language }),
      icon: CheckCircle2,
      textColor: 'text-[var(--safe-bright)]',
    },
    CAUTION: {
      bg: 'from-[var(--caution)]/20 to-[var(--bg-surface)]',
      border: 'border-[var(--caution)]/50',
      badgeBg: 'bg-[var(--caution)] text-white',
      ringColor: '#fbbf24',
      title: t('hero.proceedWithCaution'),
      titleLocal: t('hero.proceedWithCaution', { lng: language }),
      icon: AlertTriangle,
      textColor: 'text-[var(--caution-bright)]',
    },
    UNSAFE: {
      bg: 'from-[var(--unsafe)]/20 to-[var(--bg-surface)]',
      border: 'border-[var(--unsafe)]/50',
      badgeBg: 'bg-[var(--unsafe)] text-white',
      ringColor: '#f97316',
      title: t('hero.doNotSail'),
      titleLocal: t('hero.doNotSail', { lng: language }),
      icon: XOctagon,
      textColor: 'text-[var(--unsafe-bright)]',
    },
    DANGEROUS: {
      bg: 'from-[var(--dangerous)]/30 to-[var(--bg-surface)]',
      border: 'border-[var(--dangerous)]',
      badgeBg: 'bg-[var(--dangerous-bright)] text-black animate-pulse',
      ringColor: '#ef4444',
      title: t('hero.criticalDanger'),
      titleLocal: t('hero.criticalDanger', { lng: language }),
      icon: AlertOctagon,
      textColor: 'text-[var(--dangerous-bright)]',
    },
  }[category] || {
    bg: 'from-[var(--bg-surface)] to-[var(--bg-base)]',
    border: 'border-[var(--border-base)]',
    badgeBg: 'bg-[var(--bg-surface-2)] text-[var(--text-secondary)]',
    ringColor: '#576857',
    title: t('hero.assessmentUnavailable'),
    titleLocal: t('hero.assessmentUnavailable', { lng: language }),
    icon: AlertTriangle,
    textColor: 'text-[var(--text-muted)]',
  };

  const Icon = config.icon;

  const audioRef = useRef(null);

  const handleAudioPlayback = async () => {
    if (isPlayingAudio) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      stopSpeaking();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);
    const textToRead = `${config.title}. ${advice}. ${recommendations.slice(0, 2).join('. ')}`;

    try {
      if (analysis.analysis_id) {
        const voiceRes = await orcaApi.speakAnalysis(analysis.analysis_id, language);
        if (voiceRes && voiceRes.response_audio_base64) {
          const mime = voiceRes.response_audio_mime_type || 'audio/mp3';
          const audio = new Audio(`data:${mime};base64,${voiceRes.response_audio_base64}`);
          audioRef.current = audio;
          audio.onended = () => {
            setIsPlayingAudio(false);
            audioRef.current = null;
          };
          audio.onerror = () => {
            console.warn('Backend audio element error, falling back to Web Speech');
            speakText(textToRead, language);
            const est = Math.max(3000, textToRead.length * 70);
            setTimeout(() => setIsPlayingAudio(false), est);
          };
          await audio.play();
          return;
        }
      }
    } catch (err) {
      console.warn('Bhashini audio read failed, falling back to Web Speech:', err);
    }

    // Graceful fallback: Web Speech API
    speakText(textToRead, language);
    const estimatedDuration = Math.max(3000, textToRead.length * 70);
    setTimeout(() => setIsPlayingAudio(false), estimatedDuration);
  };

  const generatedAt = analysis.completed_at || analysis.created_at;
  const generatedTimeStr = generatedAt
    ? new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={`rounded-xl border ${config.border} bg-gradient-to-br ${config.bg} p-5 sm:p-7 shadow-2xl`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Left: Traffic light badge & Main Advice */}
        <div className="space-y-4 flex-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className={`px-4 py-1.5 rounded-full text-sm font-black flex items-center space-x-2 shadow-lg tracking-widest uppercase ${config.badgeBg}`}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{config.title}</span>
            </div>

            <div className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-[var(--bg-base)] border border-[var(--border-base)] text-[var(--text-secondary)]">
              {t('hero.vesselLabel')}: <span className="text-[var(--accent-primary)] font-black capitalize">{plan.vessel_type ? t(`vessels.${plan.vessel_type}`, { defaultValue: plan.vessel_type.replace(/_/g, ' ') }) : t('hero.defaultVessel')}</span>
            </div>

            <div className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-[var(--bg-base)] border border-[var(--border-base)] text-[var(--text-secondary)]">
              {t('hero.activityLabel')}: <span className="text-[var(--accent-primary)] font-black capitalize">{plan.activity ? t(`activities.${plan.activity}`, { defaultValue: plan.activity.replace(/_/g, ' ') }) : t('hero.defaultActivity')}</span>
            </div>
          </div>

          {/* Section 77: Large High-Contrast Headline Advice */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] leading-tight tracking-tight">
              {advice}
            </h2>
            {language !== 'en' && (
              <p className="text-sm font-bold text-[var(--text-secondary)] mt-1">
                {config.titleLocal}
              </p>
            )}
          </div>

          {/* Action Buttons: Listen & Advisory Report */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Audio Listen Button */}
            <button
              onClick={handleAudioPlayback}
              className={`px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 transition-all shadow-md ${
                isPlayingAudio
                  ? 'bg-[var(--accent-hover)] text-black ring-2 ring-[var(--accent-primary)] animate-pulse'
                  : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-black'
              }`}
            >
              {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isPlayingAudio ? t('hero.stopAudio') : t('hero.playAudio')}</span>
            </button>

            {/* Official Report Button */}
            <button
              onClick={onOpenReport}
              className="px-4 py-2 rounded font-bold text-[10px] uppercase tracking-widest bg-[var(--bg-surface-2)] hover:bg-[var(--border-base)] text-[var(--text-primary)] border border-[var(--border-base)] flex items-center space-x-2 transition-all"
            >
              <FileText className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>{t('results.advisoryBulletin')}</span>
            </button>

            {/* Timestamp & Validity Window Guard */}
            <div className="flex items-center space-x-1.5 px-3 py-2 rounded font-bold text-[10px] bg-[var(--bg-surface-2)] border border-[var(--border-base)] text-[var(--text-secondary)] shadow-sm">
              <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)] flex-shrink-0" />
              <span>
                {generatedTimeStr ? `${t('hero.generatedAt', { defaultValue: 'Generated' })} ${generatedTimeStr}` : t('hero.advisoryActive', { defaultValue: 'Advisory Active' })} • <span className="text-[var(--accent-primary)]">{t('hero.validityWindow', { defaultValue: 'Valid 6h' })}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Score Gauge & Key Metrics */}
        <div className="flex items-center space-x-6 bg-[var(--bg-surface-2)] p-4 rounded-xl border border-[var(--border-base)]">
          {/* Circular Score Ring */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="var(--bg-base)"
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
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
                <div className="flex items-center space-x-2 text-[var(--text-secondary)]">
                  <Waves className={`w-4 h-4 flex-shrink-0 ${waveIsHazard ? 'text-[var(--caution-bright)]' : 'text-[var(--accent-primary)]'}`} />
                  {waveVal ? (
                    <span>
                      {t('hero.waveStatus')}: <b className={waveIsHazard ? 'text-[var(--caution-bright)]' : 'text-[var(--text-primary)]'}>{waveVal}</b>
                      {periodVal && <span className="text-[var(--text-muted)]"> · {periodVal}</span>}
                    </span>
                  ) : (
                    <span>{t('hero.waveStatus')}: <b className="text-[var(--text-primary)]">{waveIsHazard ? t('hero.highRough') : t('hero.inspected')}</b></span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-[var(--text-secondary)]">
                  <Wind className={`w-4 h-4 flex-shrink-0 ${windIsHazard ? 'text-[var(--caution-bright)]' : 'text-[var(--accent-primary)]'}`} />
                  {windVal ? (
                    <span>
                      {t('hero.windStatus')}: <b className={windIsHazard ? 'text-[var(--caution-bright)]' : 'text-[var(--text-primary)]'}>{windVal}</b>
                      {gustVal && <span className="text-[var(--text-muted)]"> (gust {gustVal})</span>}
                    </span>
                  ) : (
                    <span>{t('hero.windStatus')}: <b className="text-[var(--text-primary)]">{windIsHazard ? t('hero.hazardousGusts') : t('hero.favorable')}</b></span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-[var(--text-secondary)]">
                  <Compass className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0" />
                  <span>{t('hero.safeQuadrant')}: <b className="text-[var(--accent-primary)] font-bold">{decision.preferred_point || (status === 'DANGEROUS' ? t('hero.noneStayInPort', 'None (Stay in Port)') : t('pointDetail.unavailable', 'N/A'))}</b></span>
                </div>
              </div>
            );
          })()}
        </div>

      </div>

      {/* Actionable Recommendations List */}
      {recommendations.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[var(--border-base)]">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2 flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{t('hero.operationalDirectives')}</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start space-x-2 text-xs text-[var(--text-primary)] bg-[var(--bg-base)] p-2.5 rounded border border-[var(--border-base)]">
                <span className="text-[var(--accent-primary)] font-bold">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safe Harbors recommendation */}
      {safeHarbors.length > 0 && (
        <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] bg-[var(--safe)]/10 p-2.5 rounded border border-[var(--safe)]/30 flex items-center space-x-2">
          <Compass className="w-4 h-4 text-[var(--safe-bright)] flex-shrink-0" />
          <span>{t('hero.recommendedSafeHarbors')}: <strong className="text-[var(--safe-bright)]">{safeHarbors.join(', ')}</strong></span>
        </div>
      )}
    </div>
  );
}
