/**
 * ============================================================================
 * ORCA Navigation Bar Component (src/components/Navbar.jsx)
 * ============================================================================
 * Universal navigation shell for the ORCA maritime application.
 * 
 * Responsibilities:
 * 1. Global Navigation: Tab switcher across all primary pages (Home, Setup, Advisory,
 *    Route, Trends, At-Sea Guard, Alerts, History, GIS, Profile).
 * 2. Backend Gateway Health Radar: 10-second polling heartbeat monitoring connection
 *    status to the Node.js API Gateway (/api/v1/health).
 * 3. Multilingual Language Selector: Dropdown for switching among 10 Indic languages
 *    and 'auto' detection mode, directly driving i18next runtime re-rendering.
 * 4. Sunlight Mode Toggle: High-contrast display switch for outdoor daylight visibility.
 * 5. Custom API Override Modal: Debug utility allowing developers to switch backend targets.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { 
  Anchor, 
  Sun, 
  Moon, 
  Activity, 
  Radio, 
  Globe, 
  ShieldAlert, 
  MapPin, 
  MessageSquare, 
  Layers,
  Bell,
  Navigation,
  TrendingUp,
  Clock,
  User
} from 'lucide-react';
import { orcaApi } from '../api/client';

/**
 * Universal Navigation Bar Component.
 * 
 * @param {Object} props
 * @param {string} props.activeTab - Currently active tab identifier.
 * @param {Function} props.setActiveTab - State updater for active tab.
 * @param {boolean} props.sunlightMode - Active status of high-contrast sunlight mode.
 * @param {Function} props.setSunlightMode - State updater for sunlight mode.
 * @param {string} props.selectedLang - Currently selected language code.
 * @param {Function} props.setSelectedLang - State updater for selected language.
 */
export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  sunlightMode, 
  setSunlightMode, 
  selectedLang, 
  setSelectedLang 
}) {
  const { t } = useTranslation('ui');
  // Backend gateway connection state: 'checking' | 'connected' | 'offline'
  const [backendStatus, setBackendStatus] = useState('checking');
  // Custom API configuration modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState('');

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await orcaApi.checkHealth();
        if (mounted) {
          setBackendStatus(res && res.status === 'ok' ? 'connected' : 'offline');
        }
      } catch {
        if (mounted) setBackendStatus('offline');
      }
    };

    check();
    const interval = setInterval(check, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const primaryTabs = [
    { id: 'landing',  labelKey: 'nav.home',        icon: Anchor },
    { id: 'input',    labelKey: 'nav.setup',        icon: MapPin },
    { id: 'results',  labelKey: 'nav.advisoryHub',  icon: Activity },
    { id: 'route',    labelKey: 'nav.route',        icon: Navigation },
    { id: 'trend',    labelKey: 'nav.trends',       icon: TrendingUp },
    { id: 'geofence', labelKey: 'nav.atSeaGuard',   icon: ShieldAlert },
    { id: 'alerts',   labelKey: 'nav.alerts',       icon: Bell },
    { id: 'history',  labelKey: 'nav.history',      icon: Clock },
    { id: 'gis',      labelKey: 'nav.gis',          icon: Layers },
    { id: 'profile',  labelKey: 'nav.profile',      icon: User },
  ];

  const languages = [
    { code: 'auto', label: t('nav.autoDetect') },
    { code: 'en',   label: 'English (EN)' },
    { code: 'hi',   label: 'हिन्दी (HI)' },
    { code: 'bn',   label: 'বাংলা (BN)' },
    { code: 'ta',   label: 'தமிழ் (TA)' },
    { code: 'te',   label: 'తెలుగు (TE)' },
    { code: 'or',   label: 'ଓଡ଼ିଆ (OR)' },
    { code: 'mr',   label: 'मराठी (MR)' },
    { code: 'ml',   label: 'മലയാളം (ML)' },
    { code: 'kn',   label: 'ಕನ್ನಡ (KN)' },
    { code: 'gu',   label: 'ગુજરાતી (GU)' },
  ];

  const handleLangChange = (e) => {
    const code = e.target.value;
    setSelectedLang(code);
    if (code && code !== 'auto') {
      i18next.changeLanguage(code);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-surface)] backdrop-blur-md border-b border-[var(--border-base)] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer flex-shrink-0" onClick={() => setActiveTab('landing')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-md">
              <Anchor className="w-5 h-5 text-[var(--text-primary)] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-lg tracking-wider text-[var(--text-primary)]">ORCA</span>
                <span className="px-1.5 py-0.2 text-[9px] font-mono font-semibold bg-[var(--accent-dim)] text-[var(--accent-primary)] border border-cyan-700/50 rounded">
                  SIH26176
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] font-medium tracking-tight hidden xl:block">
                Ocean Risk &amp; Coastal Advisory
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-[var(--bg-base)] p-1 rounded-xl border border-[var(--border-base)] overflow-x-auto">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-[var(--accent-primary)] text-black font-bold shadow-md shadow-lg'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
            {/* Backend Connectivity Status */}
            <button 
              type="button"
              onClick={() => {
                setCustomApiUrl(orcaApi.getApiBase());
                setShowConfigModal(true);
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-surface-2)] border border-[var(--border-base)] text-[11px] font-medium hover:border-cyan-500/50 transition cursor-pointer"
              title={t('nav.backendGateway')}
            >
              <span className={`w-2 h-2 rounded-full ${
                backendStatus === 'connected' 
                  ? 'bg-[var(--safe)] ring-2 ring-emerald-500/30 animate-ping-slow' 
                  : backendStatus === 'checking'
                  ? 'bg-[var(--caution)]'
                  : 'bg-[var(--dangerous)]'
              }`} />
              <span className="text-[var(--text-secondary)] hidden sm:inline">
                {backendStatus === 'connected' ? t('nav.online') : backendStatus === 'checking' ? t('nav.checking') : t('nav.offline')}
              </span>
            </button>

            {/* Language Selector */}
            <div className="relative flex items-center">
              <Globe className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 pointer-events-none" />
              <select
                value={selectedLang}
                onChange={handleLangChange}
                className="pl-7 pr-3 py-1 bg-[var(--bg-surface-2)] border border-[var(--border-base)] rounded-lg text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sunlight Mode Toggle */}
            <button
              onClick={() => setSunlightMode(!sunlightMode)}
              className={`p-2 rounded-lg border transition-all text-xs font-medium flex items-center space-x-1.5 ${
                sunlightMode
                  ? 'bg-[var(--caution)] text-black border-amber-300 shadow-md shadow-amber-400/20 font-bold'
                  : 'bg-[var(--bg-surface-2)] border-[var(--border-base)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title={t('nav.sunlightToggleTitle')}
            >
              {sunlightMode ? <Sun className="w-4 h-4 fill-amber-950" /> : <Sun className="w-4 h-4" />}
              <span className="hidden xl:inline">{sunlightMode ? t('nav.sunlightOn') : t('nav.sunlight')}</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex overflow-x-auto py-2 space-x-2 border-t border-[var(--border-base)] scrollbar-none">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium ${
                  isActive
                    ? 'bg-cyan-500/20 text-[var(--accent-primary)] border border-cyan-500/40'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Backend Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-base)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
                {t('nav.backendGateway')}
              </h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-[var(--text-secondary)] space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-base)] border border-[var(--border-base)]">
                <span>{t('nav.status')}</span>
                <span className={`font-bold ${backendStatus === 'connected' ? 'text-[var(--safe-bright)]' : 'text-[var(--dangerous-bright)]'}`}>
                  {backendStatus === 'connected' ? t('nav.connected') : t('nav.disconnected')}
                </span>
              </div>
              <label className="block text-[var(--text-secondary)] text-[11px] pt-1">
                {t('nav.apiUrlLabel')}
              </label>
              <input
                type="text"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                placeholder="https://orca-backend-xxxx.onrender.com/api/v1"
                className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-base)] rounded-lg text-xs text-[var(--accent-primary)] focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[10px] text-[var(--text-secondary)] leading-normal">
                {t('nav.apiUrlHint')}
              </p>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[var(--border-base)]">
              <button
                type="button"
                onClick={() => {
                  orcaApi.setApiBase('');
                  setCustomApiUrl(orcaApi.getApiBase());
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-2)] cursor-pointer"
              >
                {t('nav.resetDefault')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  orcaApi.setApiBase(customApiUrl);
                  setBackendStatus('checking');
                  setShowConfigModal(false);
                  try {
                    const res = await orcaApi.checkHealth();
                    setBackendStatus(res && res.status === 'ok' ? 'connected' : 'offline');
                  } catch {
                    setBackendStatus('offline');
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-black bg-[var(--accent-primary)] hover:bg-cyan-300 shadow-md shadow-lg cursor-pointer"
              >
                {t('nav.saveConnect')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
