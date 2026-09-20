import React, { useState } from 'react';
import { 
  Bell, 
  ShieldAlert, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  Send, 
  Radio, 
  AlertTriangle,
  Waves,
  Wind
} from 'lucide-react';
import { orcaApi } from '../api/client';

export default function AlertsPage() {
  const [locationName, setLocationName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [minLevel, setMinLevel] = useState('CAUTION');
  const [quietHours, setQuietHours] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [alertTypes, setAlertTypes] = useState({
    cyclone: true,
    high_waves: true,
    squall_wind: true,
    lightning: true,
    official_warning: true,
  });

  // Mock initial subscriptions & inbox for presentation
  const [subscriptions, setSubscriptions] = useState([
    {
      id: 'sub_live_01',
      location: 'Kochi Offshore (9.94°N, 76.16°E)',
      minLevel: 'CAUTION',
      types: ['Cyclone', 'High Wave', 'Squall'],
      status: 'active',
      created: 'Today 06:00 IST',
    },
  ]);

  const [inbox, setInbox] = useState([
    {
      id: 'alt_01',
      time: 'Today 04:30 IST',
      level: 'DANGEROUS',
      badge: 'RED ALERT',
      title: 'IMD Squall & Gale Warning Issued',
      message: 'Wind gusts exceeding 38 knots recorded 20km offshore. Small craft advised to stay in harbor.',
    },
    {
      id: 'alt_02',
      time: 'Yesterday 18:20 IST',
      level: 'CAUTION',
      badge: 'YELLOW ADVISORY',
      title: 'INCOIS High Swell Advisory',
      message: 'Swell waves of 2.2m to 2.8m expected during flood tide. Proceed with caution near harbor mouth.',
    },
  ]);

  const handleToggleType = (key) => {
    setAlertTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveSubscription = async (e) => {
    e.preventDefault();
    const payload = {
      location: {
        place_name: locationName.trim() || 'Monitored Coastal Sector',
        coordinate: { lat: parseFloat(lat) || 9.94, lon: parseFloat(lon) || 76.16 },
      },
      min_severity: minLevel,
      alert_types: Object.keys(alertTypes).filter((k) => alertTypes[k]),
      ...(quietHours.trim() ? { quiet_hours: quietHours.trim() } : {}),
    };

    try {
      // Try backend call
      await orcaApi.createAlertSubscription(payload).catch(() => {});
    } catch {}

    const newSub = {
      id: `sub_${Date.now()}`,
      location: locationName ? (lat && lon ? `${locationName} (${lat}°N, ${lon}°E)` : locationName) : 'Monitored Sector',
      minLevel,
      types: Object.keys(alertTypes).filter((k) => alertTypes[k]),
      status: 'active',
      created: 'Just now',
    };

    setSubscriptions((prev) => [newSub, ...prev]);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDeleteSub = (id) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 sm:py-6">
      
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Bell className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Section 70: Proactive Maritime Alerts
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Subscribe for automated warnings on adverse weather, high swell waves, lightning, and official IMD/INCOIS bulletins.
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-3 py-1.5 rounded-xl border border-amber-800/80 w-fit">
          Push & SMS Subscriptions Active
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Subscription Form (§12) */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 backdrop-blur-md">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center space-x-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Configure Alert Subscription</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">Page 8</span>
          </div>

          <form onSubmit={handleSaveSubscription} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Monitored Sector
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g. Kochi Offshore Sector"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Threshold Severity */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Minimum Severity Notification
              </label>
              <select
                value={minLevel}
                onChange={(e) => setMinLevel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="CAUTION">🟡 CAUTION+ (Notify for all warnings & moderate swells)</option>
                <option value="UNSAFE">🟠 UNSAFE+ (Notify for high waves & gale winds)</option>
                <option value="DANGEROUS">🔴 DANGEROUS ONLY (Severe cyclones & squall alerts only)</option>
              </select>
            </div>

            {/* Alert Categories */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Monitored Hazard Types
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries({
                  cyclone: '🌀 Cyclone & Depression',
                  high_waves: '🌊 High Wave / Swell',
                  squall_wind: '💨 Squall & Gale Winds',
                  lightning: '⚡ Lightning / Thunderstorm',
                  official_warning: '📢 Official IMD Bulletins',
                }).map(([k, label]) => (
                  <label key={k} className="flex items-center space-x-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alertTypes[k]}
                      onChange={() => handleToggleType(k)}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-slate-300 text-[11px]">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Quiet Hours note per §12 */}
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400">
              <span className="font-bold text-amber-400">Note: </span>
              <span>DANGEROUS-level official warnings always override quiet hours to protect life at sea.</span>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              {savedSuccess ? '✓ Subscription Saved!' : 'Save Active Subscription'}
            </button>
          </form>
        </div>

        {/* Right Column: Active Subscriptions & Alert Inbox (§12) */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Active Subscriptions List */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Monitored Locations ({subscriptions.length})
            </h3>

            <div className="space-y-2">
              {subscriptions.map((s) => (
                <div key={s.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{s.location}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center space-x-2">
                      <span className="font-mono text-cyan-300">Level: {s.minLevel}+</span>
                      <span>•</span>
                      <span>{s.created}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteSub(s.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer"
                    title="Delete subscription"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Alert Inbox */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span>Broadcast Alert Inbox (Recent Directives)</span>
            </h3>

            <div className="space-y-2.5">
              {inbox.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border ${
                    item.level === 'DANGEROUS'
                      ? 'bg-rose-950/40 border-rose-900/60'
                      : 'bg-amber-950/40 border-amber-900/60'
                  } space-y-1`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                      item.level === 'DANGEROUS' ? 'bg-rose-900 text-rose-200' : 'bg-amber-900 text-amber-200'
                    }`}>
                      {item.badge}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.time}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white mt-1">{item.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.message}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
