import React, { useState, useEffect } from 'react';
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
  Clock,
  User
} from 'lucide-react';
import { orcaApi } from '../api/client';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  sunlightMode, 
  setSunlightMode, 
  selectedLang, 
  setSelectedLang 
}) {
  const [backendStatus, setBackendStatus] = useState('checking');

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
    { id: 'landing', label: 'Home', icon: Anchor },
    { id: 'input', label: 'Setup', icon: MapPin },
    { id: 'results', label: 'Advisory Hub', icon: Activity },
    { id: 'route', label: 'Route', icon: Navigation },
    { id: 'geofence', label: 'At-Sea Guard', icon: ShieldAlert },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'gis', label: 'GIS', icon: Layers },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const languages = [
    { code: 'en', label: 'English (EN)' },
    { code: 'hi', label: 'हिन्दी (HI)' },
    { code: 'ta', label: 'தமிழ் (TA)' },
    { code: 'te', label: 'తెలుగు (TE)' },
    { code: 'ml', label: 'മലയാളം (ML)' },
    { code: 'bn', label: 'বাংলা (BN)' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer flex-shrink-0" onClick={() => setActiveTab('landing')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-cyan-500/20 shadow-md">
              <Anchor className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-lg tracking-wider text-white">ORCA</span>
                <span className="px-1.5 py-0.2 text-[9px] font-mono font-semibold bg-cyan-950 text-cyan-400 border border-cyan-700/50 rounded">
                  SIH26176
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-tight hidden xl:block">
                Ocean Risk & Coastal Advisory
              </p>
            </div>
          </div>

          {/* Navigation Tabs covering all frontend_plan.md pages */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 overflow-x-auto">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
            {/* Backend Connectivity Status */}
            <div 
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] font-medium"
              title={backendStatus === 'connected' ? 'Backend Port 4000 Active' : 'Backend Disconnected'}
            >
              <span className={`w-2 h-2 rounded-full ${
                backendStatus === 'connected' 
                  ? 'bg-emerald-400 ring-2 ring-emerald-500/30 animate-ping-slow' 
                  : backendStatus === 'checking'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`} />
              <span className="text-slate-300 hidden sm:inline">
                {backendStatus === 'connected' ? 'Port 4000' : backendStatus === 'checking' ? 'Checking...' : 'Offline'}
              </span>
            </div>

            {/* Language Selector */}
            <div className="relative flex items-center">
              <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="pl-7 pr-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code} className="bg-slate-900 text-white">
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
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/20 font-bold'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Toggle Sunlight High-Contrast Mode for Fisherman Deck Visibility"
            >
              {sunlightMode ? <Sun className="w-4 h-4 fill-amber-950" /> : <Sun className="w-4 h-4" />}
              <span className="hidden xl:inline">{sunlightMode ? 'Sunlight ON' : 'Sunlight'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex overflow-x-auto py-2 space-x-2 border-t border-slate-800 scrollbar-none">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
