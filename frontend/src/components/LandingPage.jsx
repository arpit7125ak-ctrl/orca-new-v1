/**
 * ============================================================================
 * ORCA Landing Page Component (src/components/LandingPage.jsx)
 * ============================================================================
 * Overview and welcome hero for the ORCA platform.
 * 
 * Key Elements:
 * 1. Strategic Hero Headline: Direct value proposition for coastal safety.
 * 2. 4 Core Pillars: Weather, Ocean, Ecosystem, and Risk Intelligence.
 * 3. Quick-Start Mission Presets: Instant launch buttons for prominent hubs
 *    (Offshore Kochi, Veraval Coast, Palk Strait).
 * 4. Architecture Section Highlights: Sections 77 (Fisherman UI), 78 (Explainable AI),
 *    and 79 (Visible Multi-Agent Reasoning).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Anchor, 
  ArrowRight, 
  CloudSun, 
  Waves, 
  ShieldAlert, 
  Scale, 
  Cpu, 
  Compass, 
  CheckCircle2, 
  Play, 
  MapPin, 
  Radio 
} from 'lucide-react';

/**
 * Landing Page Component.
 * 
 * @param {Object} props
 * @param {Function} props.onStartAnalysis - Callback to navigate to setup/input page.
 * @param {Function} props.onQuickSelect - Callback to trigger analysis with preset hub.
 */
export default function LandingPage({ onStartAnalysis, onQuickSelect }) {
  const { t } = useTranslation('ui');

  // Core intelligence pillars rendered in the hero footer
  const pillars = [
    { labelKey: 'landing.weather', icon: CloudSun, color: 'text-[var(--caution-bright)]', descKey: 'landing.weatherDesc' },
    { labelKey: 'landing.ocean',   icon: Waves,    color: 'text-[var(--accent-primary)]',   descKey: 'landing.oceanDesc' },
    { labelKey: 'landing.ecosystem', icon: ShieldAlert, color: 'text-[var(--safe-bright)]', descKey: 'landing.ecosystemDesc' },
    { labelKey: 'landing.risk',    icon: Scale,    color: 'text-[var(--accent-primary)]', descKey: 'landing.riskDesc' },
  ];

  const presets = [
    { title: 'Offshore Kochi', vessel: 'Motorized Country Craft', loc: { lat: 9.93, lon: 76.26 } },
    { title: 'Veraval Coast', vessel: 'Mechanized Trawler', loc: { lat: 20.89, lon: 70.36 } },
    { title: 'Palk Strait', vessel: 'Traditional Canoe', loc: { lat: 9.50, lon: 79.52 } },
  ];

  return (
    <div className="space-y-12 py-6 sm:py-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border-base)] bg-gradient-to-b from-slate-900/90 via-[var(--bg-base)] to-[var(--bg-base)] p-8 sm:p-16 text-center shadow-2xl backdrop-blur-md">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent pointer-events-none" />
        
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/80 text-xs font-semibold text-[var(--accent-primary)] mb-6 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
          <span>{t('landing.badge')}</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[var(--text-primary)] tracking-tight leading-tight max-w-4xl mx-auto">
          {t('landing.headline1')} <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
            {t('landing.headline2')}
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-5 text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
          {t('landing.subtitle')}
        </p>

        {/* CTA Button */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onStartAnalysis}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-hover)] hover:from-cyan-400 hover:to-blue-500 text-black font-black text-base flex items-center justify-center space-x-3 transition-all shadow-xl shadow-cyan-500/25 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <span>{t('landing.startAnalysis')}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Core Pillars */}
        <div className="mt-12 pt-8 border-t border-[var(--border-base)] max-w-3xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            {pillars.map((p, idx) => {
              const Icon = p.icon;
              return (
                <div key={idx} className="bg-[var(--bg-surface)] p-3.5 rounded-xl border border-[var(--border-base)]">
                  <div className="flex items-center space-x-2 mb-1">
                    <Icon className={`w-4 h-4 ${p.color}`} />
                    <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">{t(p.labelKey)}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-tight">{t(p.descKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quick Launch Mission Presets */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center space-x-2">
              <Compass className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>{t('landing.instantMissions')}</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">{t('landing.jumpInto')}</p>
          </div>
          <button
            onClick={onStartAnalysis}
            className="text-xs text-[var(--accent-primary)] hover:text-cyan-300 font-semibold flex items-center space-x-1"
          >
            <span>{t('landing.customCoordinate')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {presets.map((p, idx) => (
            <div
              key={idx}
              onClick={() => onQuickSelect && onQuickSelect(p)}
              className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-base)] hover:border-cyan-500/50 transition-all cursor-pointer group shadow-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-cyan-300 transition-colors flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{p.title}</span>
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[var(--bg-surface-2)] text-[var(--text-secondary)]">
                  {p.loc.lat}°N, {p.loc.lon}°E
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-3">{p.vessel}</p>
              <div className="text-[11px] font-bold text-[var(--accent-primary)] flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                <span>{t('landing.evaluateSafety')}</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* System Highlights */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-base)] space-y-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[var(--accent-primary)]">
            <Cpu className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('landing.multiAgent')}</h4>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('landing.multiAgentDesc')}</p>
        </div>

        <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-base)] space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-[var(--accent-primary)]">
            <Scale className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('landing.explainableAi')}</h4>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('landing.explainableAiDesc')}</p>
        </div>

        <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-base)] space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[var(--safe-bright)]">
            <Radio className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('landing.fishermanUi')}</h4>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('landing.fishermanUiDesc')}</p>
        </div>
      </section>
    </div>
  );
}
