import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { 
  Anchor, Sun, Activity, Globe, ShieldAlert, MapPin, 
  Layers, Bell, Navigation, TrendingUp, Clock, User, 
  Menu, X, Search, FileText
} from 'lucide-react';
import { orcaApi } from '../api/client';

export default function OrcaSidebar({ 
  activeTab, setActiveTab, sunlightMode, setSunlightMode, selectedLang, setSelectedLang 
}) {
  const { t } = useTranslation('ui');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const languages = [
    { code: 'auto', label: 'Auto Detect' },
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
    if (code && code !== 'auto') i18next.changeLanguage(code);
  };

  const navGroups = [
    {
      title: 'OPERATE',
      items: [
        { id: 'landing', labelKey: 'nav.home', icon: Anchor, fallback: 'Dashboard' },
        { id: 'input', labelKey: 'nav.setup', icon: MapPin, fallback: 'Setup' },
        { id: 'results', labelKey: 'nav.advisoryHub', icon: FileText, fallback: 'Advisory' },
        { id: 'route', labelKey: 'nav.route', icon: Navigation, fallback: 'Route Planner' }
      ]
    },
    {
      title: 'MONITOR',
      items: [
        { id: 'geofence', labelKey: 'nav.atSeaGuard', icon: ShieldAlert, fallback: 'At-Sea Guard' },
        { id: 'alerts', labelKey: 'nav.alerts', icon: Bell, fallback: 'Alerts' },
        { id: 'gis', labelKey: 'nav.gis', icon: Layers, fallback: 'GIS Explorer' }
      ]
    },
    {
      title: 'ANALYZE',
      items: [
        { id: 'trend', labelKey: 'nav.trends', icon: TrendingUp, fallback: 'Trends' },
        { id: 'history', labelKey: 'nav.history', icon: Clock, fallback: 'History' }
      ]
    }
  ];

  const renderNavButton = (item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => { setActiveTab(item.id); setIsMobileOpen(false); }}
        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1
          ${isActive 
            ? 'bg-[var(--bg-surface-2)] text-[var(--accent-primary)] border-l-2 border-[var(--accent-primary)]' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'}`}
      >
        <Icon className="w-4 h-4" />
        <span>{t(item.labelKey, { defaultValue: item.fallback })}</span>
      </button>
    );
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-[var(--bg-base)] border-r border-[var(--border-base)] w-64 overflow-y-auto">
      {/* Brand */}
      <div className="p-4 border-b border-[var(--border-base)] flex items-center space-x-3">
        <div className="w-10 h-10 rounded bg-[var(--accent-glow)] border border-[var(--accent-dim)] flex items-center justify-center">
          <Anchor className="w-6 h-6 text-[var(--accent-primary)]" />
        </div>
        <div>
          <div className="font-black text-lg tracking-[0.15em] text-[var(--text-primary)]">ORCA</div>
          <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Command Center</div>
        </div>
      </div>

      {/* Nav Groups */}
      <div className="flex-1 p-3 overflow-y-auto">
        {navGroups.map((group, idx) => (
          <div key={idx} className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] px-3 mb-2">
              {group.title}
            </div>
            {group.items.map(renderNavButton)}
          </div>
        ))}

        <div className="mb-2">
           <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] px-3 mb-2">
              SETTINGS
            </div>
            {renderNavButton({ id: 'profile', labelKey: 'nav.profile', icon: User, fallback: 'Profile & Settings' })}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="p-4 border-t border-[var(--border-base)] space-y-3 bg-[var(--bg-surface)]">
        {/* Language */}
        <div className="relative flex items-center">
          <Globe className="w-4 h-4 text-[var(--text-secondary)] absolute left-2.5 pointer-events-none" />
          <select
            value={selectedLang}
            onChange={handleLangChange}
            className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border-base)] rounded text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
          >
            {languages.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Sunlight Mode */}
        <button
          onClick={() => setSunlightMode(!sunlightMode)}
          className={`w-full flex items-center justify-center space-x-2 py-1.5 rounded text-xs font-bold border transition-colors ${
            sunlightMode
              ? 'bg-[var(--accent-primary)] text-black border-[var(--accent-primary)]'
              : 'bg-[var(--bg-base)] text-[var(--text-secondary)] border-[var(--border-base)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Sun className="w-4 h-4" />
          <span>{sunlightMode ? 'Sunlight Mode ON' : 'Sunlight Mode OFF'}</span>
        </button>

        {/* Backend Status */}
        <button 
          onClick={() => { setCustomApiUrl(orcaApi.getApiBase()); setShowConfigModal(true); }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-[var(--bg-base)] border border-[var(--border-base)] text-[11px] font-medium hover:border-[var(--accent-primary)]"
        >
          <span className="text-[var(--text-secondary)]">System Status</span>
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${
              backendStatus === 'connected' ? 'bg-[var(--safe)] animate-pulse' : 
              backendStatus === 'checking' ? 'bg-[var(--caution)]' : 'bg-[var(--unsafe)]'
            }`} />
            <span className={backendStatus === 'connected' ? 'text-[var(--safe-bright)]' : 'text-[var(--dangerous-bright)]'}>
              {backendStatus === 'connected' ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </button>

        {/* Emergency Footer Info */}
        <div className="pt-2 text-[10px] text-[var(--text-muted)] flex flex-col space-y-1">
          <div className="flex justify-between"><span>MRCC:</span> <span className="text-[var(--accent-primary)] font-bold">1554</span></div>
          <div className="flex justify-between"><span>VHF Guard:</span> <span className="text-[var(--accent-primary)] font-bold">CH 16</span></div>
        </div>
      </div>

      {/* Backend Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-lg p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b border-[var(--border-base)] pb-2">
              <h3 className="text-[var(--text-primary)] font-bold">API Gateway Settings</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-4 h-4"/></button>
            </div>
            <div className="space-y-4 text-sm">
               <input
                type="text"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                placeholder="Custom API URL"
                className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-base)] rounded focus:border-[var(--accent-primary)] text-[var(--text-primary)] focus:outline-none"
              />
              <div className="flex justify-between">
                <button onClick={() => { orcaApi.setApiBase(''); setCustomApiUrl(orcaApi.getApiBase()); }} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Reset</button>
                <button onClick={async () => {
                  orcaApi.setApiBase(customApiUrl);
                  setBackendStatus('checking');
                  setShowConfigModal(false);
                  try {
                    const res = await orcaApi.checkHealth();
                    setBackendStatus(res && res.status === 'ok' ? 'connected' : 'offline');
                  } catch {
                    setBackendStatus('offline');
                  }
                }} className="px-4 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-black font-bold text-xs rounded">Save & Connect</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[var(--bg-surface)] border-b border-[var(--border-base)] flex items-center justify-between px-4 z-40">
        <div className="flex items-center space-x-2">
          <Anchor className="w-5 h-5 text-[var(--accent-primary)]" />
          <span className="font-black text-[var(--text-primary)] tracking-wider">ORCA</span>
        </div>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="text-[var(--text-primary)]">
          {isMobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block h-screen sticky top-0 shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex pt-14">
          <div className="w-64 bg-[var(--bg-base)] border-r border-[var(--border-base)]">{sidebarContent}</div>
          <div className="flex-1 bg-black/50" onClick={() => setIsMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
