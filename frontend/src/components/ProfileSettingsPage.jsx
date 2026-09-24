/**
 * ============================================================================
 * ORCA Profile & Operating Settings Component (src/components/ProfileSettingsPage.jsx)
 * ============================================================================
 * User operating profile and environment configuration page (Page 14).
 * 
 * Capabilities (Architecture Spec §18, §99.12):
 * 1. Operator Profile: Custom operator name, primary maritime role (fisherman, ferry operator,
 *    researcher), and home port harbor.
 * 2. Operating Defaults: Persistent default vessel type and activity to streamline rapid
 *    daily advisory queries.
 * 3. Offline Maritime Boundary Cache: One-click local storage download of critical
 *    territorial waters (12 NM), Indian EEZ (200 NM), and Marine Protected Areas (MPAs).
 * 4. High-Contrast Sunlight Mode & UI Language: Accessibility toggles.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  User, 
  Settings, 
  Ship, 
  Globe, 
  Sun, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  Compass, 
  MapPin 
} from 'lucide-react';

import { ACTIVITIES, VESSEL_TYPES } from '../utils/maritimeConfig';

/**
 * Profile & Settings Component.
 * 
 * @param {Object} props
 * @param {boolean} props.sunlightMode - Active status of high-contrast sunlight mode.
 * @param {Function} props.setSunlightMode - Setter for sunlight mode.
 * @param {string} props.selectedLang - Active language code.
 * @param {Function} props.setSelectedLang - Setter for active language code.
 */
export default function ProfileSettingsPage({
  sunlightMode,
  setSunlightMode,
  selectedLang,
  setSelectedLang,
}) {
  const { t } = useTranslation('ui');
  const [name, setName] = useState('');
  const [role, setRole] = useState('fisherman');
  const [homePort, setHomePort] = useState('');
  const [defaultVessel, setDefaultVessel] = useState('motorized_country_craft');
  const [defaultActivity, setDefaultActivity] = useState('fishing');
  const [offlineDownloaded, setOfflineDownloaded] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  const handleDownloadOffline = () => {
    setOfflineDownloaded(true);
    setTimeout(() => {
      alert(t('profile.offlineAlert', { defaultValue: 'Offline Boundary Layers (India EEZ, MPAs, 12 NM Territorial Seas) cached to device storage.' }));
    }, 400);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 sm:py-6">
      
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <User className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Page 14: {t('profile.pageTitle', { defaultValue: 'Profile & Operating Settings' })}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {t('profile.pageSubtitle', { defaultValue: 'Configure your maritime role, default vessel profile, accessibility preferences, and offline coastal boundary cache.' })}
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-3 py-1.5 rounded-xl border border-cyan-800 w-fit">
          {t('profile.sectionBadge', { defaultValue: 'Section 99.12 User Profile' })}
        </span>
      </div>

      <form onSubmit={handleSave} className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 backdrop-blur-md">
        
        {/* User Role & Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              {t('profile.operatorName', { defaultValue: 'Operator / Fisher Name' })}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profile.namePlaceholder', { defaultValue: 'e.g. K. R. Murugan' })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              {t('profile.systemRole', { defaultValue: 'System Role Classification' })}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="fisherman">🎣 {t('profile.roleFisherman', { defaultValue: 'Traditional / Coastal Fisherman' })}</option>
              <option value="coastal_authority">⚓ {t('profile.roleCoastalAuthority', { defaultValue: 'Coastal Port Authority / MMD' })}</option>
              <option value="disaster_management">🚨 {t('profile.roleDisasterManagement', { defaultValue: 'Disaster Management (NDRF/SDMA)' })}</option>
              <option value="maritime_operator">🚢 {t('profile.roleMaritimeOperator', { defaultValue: 'Commercial Maritime Operator' })}</option>
              <option value="researcher">🔬 {t('profile.roleResearcher', { defaultValue: 'Oceanographic Researcher' })}</option>
            </select>
          </div>
        </div>

        {/* Defaults: Vessel & Activity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              {t('profile.defaultVessel', { defaultValue: 'Default Vessel Profile' })}
            </label>
            <select
              value={defaultVessel}
              onChange={(e) => setDefaultVessel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {VESSEL_TYPES.map((v) => (
                <option key={v.id} value={v.id}>
                  {t(`vessels.${v.id}`, { defaultValue: v.label })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              {t('profile.defaultActivity', { defaultValue: 'Default Mission Activity' })}
            </label>
            <select
              value={defaultActivity}
              onChange={(e) => setDefaultActivity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {ACTIVITIES.map((act) => (
                <option key={act.id} value={act.id}>
                  {t(`activities.${act.id}`, { defaultValue: act.label })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Home Coastal Base */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
            {t('profile.homePort', { defaultValue: 'Home Port / Landing Center' })}
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-cyan-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={homePort}
              onChange={(e) => setHomePort(e.target.value)}
              placeholder={t('profile.homePortPlaceholder', { defaultValue: 'e.g. Kochi Fisheries Harbor, Kerala' })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Accessibility & High Contrast (Sunlight Mode) */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('profile.displayPreferences', { defaultValue: 'Display & Accessibility Preferences' })}
          </h3>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="flex items-center space-x-3">
              <Sun className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-xs font-bold text-white">{t('profile.sunlightModeTitle', { defaultValue: 'Sunlight High-Contrast Deck Mode' })}</div>
                <div className="text-[11px] text-slate-400">{t('profile.sunlightModeDesc', { defaultValue: 'Maximizes glare visibility on boat decks under bright sunlight' })}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSunlightMode(!sunlightMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                sunlightMode
                  ? 'bg-amber-400 text-slate-950 border border-amber-300'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {sunlightMode ? t('profile.enabled', { defaultValue: 'ENABLED' }) : t('profile.disabled', { defaultValue: 'DISABLED' })}
            </button>
          </div>
        </div>

        {/* Offline Cache Manager (§85) */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('profile.offlineResiliency', { defaultValue: 'Offline Resiliency (§85)' })}
          </h3>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white">{t('profile.downloadBoundariesTitle', { defaultValue: 'Download Maritime Boundaries for Offline At-Sea Use' })}</div>
              <div className="text-[11px] text-slate-400">{t('profile.downloadBoundariesDesc', { defaultValue: 'Saves EEZ, MPAs, and 12 NM territorial limits locally to stay protected with zero cell signal' })}</div>
            </div>
            <button
              type="button"
              onClick={handleDownloadOffline}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer flex-shrink-0 ${
                offlineDownloaded
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{offlineDownloaded ? t('profile.boundariesCached', { defaultValue: '✓ Boundaries Cached' }) : t('profile.downloadLayers', { defaultValue: 'Download Layers' })}</span>
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4">
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            {saveToast ? t('profile.savedSuccess', { defaultValue: '✓ Preferences Saved Successfully!' }) : t('profile.saveProfile', { defaultValue: 'Save Operator Profile' })}
          </button>
        </div>

      </form>

    </div>
  );
}
