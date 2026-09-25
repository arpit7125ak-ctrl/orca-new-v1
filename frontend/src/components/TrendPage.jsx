/**
 * ============================================================================
 * ORCA Decadal Oceanographic Trend Analyzer (src/components/TrendPage.jsx)
 * ============================================================================
 * Historical multi-year climate analysis and trend exploration page (Page 11).
 * 
 * Capabilities (Architecture Spec §72):
 * 1. Multi-Year Environmental Parameters: Analyzes historical shifts in:
 *    - Sea Surface Temperature (SST warming rates °C/yr)
 *    - Significant Wave Height (Hs changes in meters)
 *    - Swell dynamics & wave period shifts
 *    - Ocean current speeds
 *    - Chlorophyll-a / phytoplankton productivity
 * 2. Baseline vs. Analysis Comparison: Statistical comparison between baseline periods
 *    (e.g. 2021-2023) and recent target periods (e.g. 2024-2025).
 * 3. Statistical Confidence & Theil-Sen Slopes: Displays statistical significance,
 *    p-values, and rate of change per year.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  TrendingUp, 
  MapPin, 
  Calendar, 
  Layers, 
  Sparkles, 
  RotateCcw, 
  AlertCircle, 
  Loader2,
  HelpCircle,
  Clock
} from 'lucide-react';
import { orcaApi } from '../api/client';
import { addEntry } from '../utils/history';
import TrendView from './TrendView';

/**
 * Standard oceanographic trend parameters.
 */
const PARAMETERS = [
  { id: 'sea_surface_temperature', labelKey: 'trend.paramSst', unit: '°C' },
  { id: 'wave_height', labelKey: 'trend.paramWaveHeight', unit: 'm' },
  { id: 'swell_height', labelKey: 'trend.paramSwellHeight', unit: 'm' },
  { id: 'wave_period', labelKey: 'trend.paramWavePeriod', unit: 's' },
  { id: 'current_speed', labelKey: 'trend.paramCurrentSpeed', unit: 'm/s' },
  { id: 'chlorophyll', labelKey: 'trend.paramChlorophyll', unit: 'mg/m³' },
];

/**
 * Historical Trend Analysis Page Component.
 * 
 * @param {Object} props
 * @param {string} [props.selectedLang='auto'] - Active language code.
 * @param {Function} props.onNavigateToTab - Global navigation router handler.
 */
export default function TrendPage({ selectedLang = 'auto', onNavigateToTab }) {
  const { t } = useTranslation('ui');

  const [placeName, setPlaceName] = useState('Kochi');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [parameter, setParameter] = useState('sea_surface_temperature');
  const [baselineStart, setBaselineStart] = useState('2021-01-01');
  const [baselineEnd, setBaselineEnd] = useState('2023-12-31');
  const [analysisStart, setAnalysisStart] = useState('2024-01-01');
  const [analysisEnd, setAnalysisEnd] = useState('2025-12-31');
  const [freeTextQuery, setFreeTextQuery] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [trendResult, setTrendResult] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setTrendResult(null);
    setStatusMessage(t('trend.statusSubmitting'));

    try {
      const payload = {
        parameter,
      };

      if (placeName && placeName.trim()) {
        payload.place_name = placeName.trim();
      }
      if (lat && lon && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon))) {
        payload.coordinate = {
          lat: parseFloat(lat),
          lon: parseFloat(lon),
        };
      }
      if (freeTextQuery && freeTextQuery.trim()) {
        payload.query = freeTextQuery.trim();
      }

      if (baselineStart && baselineEnd) {
        payload.baseline_period = {
          start: baselineStart,
          end: baselineEnd,
        };
      }
      if (analysisStart && analysisEnd) {
        payload.analysis_period = {
          start: analysisStart,
          end: analysisEnd,
        };
      }

      if (selectedLang && selectedLang !== 'auto') {
        payload.language_override = selectedLang;
      }

      const res = await orcaApi.createTrend(payload);
      const aid = res.analysis_id;

      if (!aid) {
        throw new Error(t('trend.errorNoId'));
      }

      setStatusMessage(t('trend.statusEstimating'));

      const completed = await orcaApi.pollAnalysisUntilDone(aid, (prog) => {
        if (prog.status === 'running') {
          setStatusMessage(t('trend.statusProcessing'));
        }
      }, 2000, 300);

      const trendData = completed.trend_result || completed;
      setTrendResult(trendData);

      // Record to history
      addEntry({
        analysis_id: aid,
        kind: 'trend',
        title: `${parameter.replace(/_/g, ' ')} Trend`,
        place: placeName || (lat ? `${lat}°N, ${lon}°E` : 'Coastal Sector'),
        created_at: new Date().toISOString(),
      });

    } catch (err) {
      console.error('Trend analysis failed:', err);
      setErrorMessage(err.message || t('trend.errorFailed'));
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-7 py-4 sm:py-6">
      
      {/* Page Header */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <TrendingUp className="w-6 h-6 text-[var(--accent-primary)]" />
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {t('trend.title')}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            {t('trend.subtitle')}
          </p>
        </div>

        <span className="text-xs font-mono font-bold text-[var(--accent-primary)] bg-[var(--accent-dim)] px-3 py-1.5 rounded-xl border border-[var(--accent-primary)] w-fit">
          {t('trend.badge')}
        </span>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-[var(--dangerous)] text-rose-200 flex items-start space-x-3 text-xs sm:text-sm shadow-lg">
          <AlertCircle className="w-5 h-5 text-[var(--dangerous-bright)] mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-bold">{t('trend.trendError')}: </span>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-[var(--dangerous-bright)] hover:text-[var(--text-primary)] font-semibold">
            {t('route.dismiss')}
          </button>
        </div>
      )}

      {/* Setup Form */}
      <form onSubmit={handleSubmit} className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Location Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t('trend.targetSectorLabel')}</span>
            </label>

            <div>
              <input
                type="text"
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder={t('trend.placeNamePlaceholder')}
                className="w-full bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-slate-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="number"
                step="0.01"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder={t('trend.latPlaceholder')}
                className="bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3 py-2 text-[var(--text-primary)] placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono text-[11px]"
              />
              <input
                type="number"
                step="0.01"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder={t('trend.lonPlaceholder')}
                className="bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3 py-2 text-[var(--text-primary)] placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Parameter Select */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t('trend.oceanParamLabel')}</span>
            </label>

            <select
              value={parameter}
              onChange={(e) => setParameter(e.target.value)}
              className="w-full bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer font-medium"
            >
              {PARAMETERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {t(p.labelKey)} ({p.unit})
                </option>
              ))}
            </select>

            <p className="text-[11px] text-[var(--text-secondary)] italic">
              {t('trend.chlorophyllProxyNote')}
            </p>
          </div>

        </div>

        {/* Temporal Windows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-base)]">
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center space-x-1">
              <Calendar className="w-3 h-3 text-[var(--accent-primary)]" />
              <span>{t('trend.baselineWindowLabel')}</span>
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="date"
                value={baselineStart}
                onChange={(e) => setBaselineStart(e.target.value)}
                className="bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3 py-2 text-[var(--text-primary)] font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <input
                type="date"
                value={baselineEnd}
                onChange={(e) => setBaselineEnd(e.target.value)}
                className="bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3 py-2 text-[var(--text-primary)] font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center space-x-1">
              <Calendar className="w-3 h-3 text-[var(--accent-primary)]" />
              <span>{t('trend.analysisWindowLabel')}</span>
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="date"
                value={analysisStart}
                onChange={(e) => setAnalysisStart(e.target.value)}
                className="bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3 py-2 text-[var(--text-primary)] font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <input
                type="date"
                value={analysisEnd}
                onChange={(e) => setAnalysisEnd(e.target.value)}
                className="bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3 py-2 text-[var(--text-primary)] font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Free text prompt */}
        <div className="space-y-2 pt-2 border-t border-[var(--border-base)]">
          <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{t('trend.researchQueryLabel')}</span>
          </label>
          <input
            type="text"
            value={freeTextQuery}
            onChange={(e) => setFreeTextQuery(e.target.value)}
            placeholder={t('trend.researchQueryPlaceholder')}
            className="w-full bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-slate-500 font-medium"
          />
        </div>

        {/* Submit */}
        <div className="pt-2 flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)] font-mono">
            {isLoading && (
              <span className="flex items-center space-x-2 text-[var(--accent-primary)]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{statusMessage || t('common.loading')}</span>
              </span>
            )}
          </span>

          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-purple-500 text-[var(--text-primary)] font-bold text-xs sm:text-sm transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50 cursor-pointer flex items-center space-x-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            <span>{t('trend.calculateButton')}</span>
          </button>
        </div>
      </form>

      {/* Render Results */}
      {trendResult && (
        <div className="pt-2">
          <TrendView trendResult={trendResult} />
        </div>
      )}

    </div>
  );
}
