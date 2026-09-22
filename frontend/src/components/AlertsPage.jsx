import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  ShieldAlert, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  Radio, 
  AlertTriangle,
  Waves,
  Wind,
  Info,
  RefreshCw,
  Zap,
  EyeOff
} from 'lucide-react';
import { orcaApi } from '../api/client';

const ALERT_TYPE_OPTIONS = [
  { key: 'cyclone', label: 'Cyclone & Depression', icon: '🌀' },
  { key: 'strong_wind', label: 'Strong / Gale Winds', icon: '💨' },
  { key: 'high_wave', label: 'High Waves', icon: '🌊' },
  { key: 'swell_surge', label: 'Swell Surge / Kallakkadal', icon: '🌊' },
  { key: 'lightning', label: 'Lightning Strike Risk', icon: '⚡' },
  { key: 'thunderstorm', label: 'Thunderstorm Squall', icon: '⛈️' },
  { key: 'poor_visibility', label: 'Poor Visibility / Fog', icon: '🌫️' },
  { key: 'official_warning', label: 'Official IMD / INCOIS Bulletins', icon: '📢' },
  { key: 'other_hazard', label: 'Other Maritime Hazards', icon: '⚠️' },
];

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getSubscriberId() {
  if (typeof window === 'undefined') return 'sub-anonymous';
  let id = localStorage.getItem('ORCA_SUBSCRIBER_ID');
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `sub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('ORCA_SUBSCRIBER_ID', id);
  }
  return id;
}

function getStoredSubscriptions() {
  try {
    const raw = localStorage.getItem('ORCA_ALERT_SUBSCRIPTIONS');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredSubscriptions(subs) {
  try {
    localStorage.setItem('ORCA_ALERT_SUBSCRIPTIONS', JSON.stringify(subs));
  } catch (err) {
    console.error('Failed to persist subscriptions to localStorage:', err);
  }
}

export default function AlertsPage() {
  const [subscriberId] = useState(getSubscriberId);
  const [locationName, setLocationName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [minLevel, setMinLevel] = useState('CAUTION');
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');
  
  const [selectedTypes, setSelectedTypes] = useState({
    cyclone: true,
    strong_wind: true,
    high_wave: true,
    swell_surge: true,
    official_warning: true,
    lightning: false,
    thunderstorm: false,
    poor_visibility: false,
    other_hazard: false,
  });

  const [subscriptions, setSubscriptions] = useState(getStoredSubscriptions);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Server web push capability state
  const [webPushConfig, setWebPushConfig] = useState({ enabled: false, vapid_public_key: null, checked: false });
  const [browserPushPermission, setBrowserPushPermission] = useState('default');
  const [pushSubPayload, setPushSubPayload] = useState(null);

  // Check server config and web push capabilities
  useEffect(() => {
    let isMounted = true;
    orcaApi.getConfig()
      .then((cfg) => {
        if (!isMounted) return;
        const wp = cfg?.web_push || { enabled: false, vapid_public_key: null };
        setWebPushConfig({ enabled: Boolean(wp.enabled), vapid_public_key: wp.vapid_public_key, checked: true });
      })
      .catch((err) => {
        if (!isMounted) return;
        setWebPushConfig({ enabled: false, vapid_public_key: null, checked: true });
      });

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPushPermission(Notification.permission);
    }

    return () => { isMounted = false; };
  }, []);

  // Request browser push subscription if server has VAPID
  const handleEnableWebPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setErrorMsg('Push messaging is not supported in this browser environment.');
      return;
    }
    if (!webPushConfig.vapid_public_key) {
      setErrorMsg('Server does not provide a VAPID public key.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setBrowserPushPermission(permission);
      if (permission !== 'granted') {
        setErrorMsg('Notification permission was denied or dismissed.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(webPushConfig.vapid_public_key),
        });
      }
      setPushSubPayload(sub ? sub.toJSON() : null);
      setSuccessMsg('Web Push notifications enabled successfully on this device!');
    } catch (err) {
      console.error('Failed to subscribe to Web Push:', err);
      setErrorMsg(`Web Push subscription error: ${err.message}`);
    }
  };

  // Load events for active subscriptions
  const refreshEvents = useCallback(async (subsToPoll) => {
    const list = subsToPoll || subscriptions;
    if (!list || list.length === 0) {
      setEvents([]);
      return;
    }

    setEventsLoading(true);
    const allEvents = [];
    for (const sub of list) {
      if (!sub.subscription_id) continue;
      try {
        const res = await orcaApi.getSubscriptionEvents(sub.subscription_id);
        const subEvents = res?.events || [];
        for (const ev of subEvents) {
          allEvents.push({ ...ev, subscription_label: sub.location_label || sub.subscription_id });
        }
      } catch (err) {
        console.warn(`Could not load events for subscription ${sub.subscription_id}:`, err.message);
      }
    }
    // Sort descending by event timestamp
    allEvents.sort((a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0));
    setEvents(allEvents);
    setEventsLoading(false);
  }, [subscriptions]);

  useEffect(() => {
    refreshEvents(subscriptions);
  }, [subscriptions.length]);

  const handleToggleType = (key) => {
    setSelectedTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveSubscription = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const placeName = locationName.trim();
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    const hasCoord = !isNaN(latNum) && !isNaN(lonNum);

    if (!placeName && !hasCoord) {
      setErrorMsg('Please specify a coastal place name or GPS coordinate (latitude & longitude).');
      return;
    }

    const alertTypesArray = Object.keys(selectedTypes).filter((k) => selectedTypes[k]);
    if (alertTypesArray.length === 0) {
      setErrorMsg('Please select at least one hazard type to monitor.');
      return;
    }

    // Build contract-compliant payload per contracts/api/AlertSubscriptionRequest.json
    const locationObj = {};
    if (placeName) locationObj.place_name = placeName;
    if (hasCoord) locationObj.coordinate = { lat: latNum, lon: lonNum };

    const payload = {
      subscriber_id: subscriberId,
      location: locationObj,
      alert_types: alertTypesArray,
      minimum_level: minLevel,
      channel: 'web_push',
    };

    if (quietStart.trim() && quietEnd.trim()) {
      payload.quiet_hours = { start: quietStart.trim(), end: quietEnd.trim() };
    }

    if (pushSubPayload) {
      payload.push_subscription = pushSubPayload;
    }

    setSubmitting(true);
    try {
      const res = await orcaApi.createAlertSubscription(payload);
      const subId = res?.subscription_id || `sub_${Date.now()}`;
      
      const newEntry = {
        subscription_id: subId,
        subscriber_id: subscriberId,
        location_label: placeName || (hasCoord ? `${latNum.toFixed(2)}°N, ${lonNum.toFixed(2)}°E` : 'Monitored Sector'),
        minimum_level: minLevel,
        alert_types: alertTypesArray,
        channel: 'web_push',
        created_at: res?.created_at || new Date().toISOString(),
        has_push: Boolean(pushSubPayload),
      };

      const updated = [newEntry, ...subscriptions];
      setSubscriptions(updated);
      saveStoredSubscriptions(updated);

      setSuccessMsg(`Subscription registered successfully (ID: ${subId.slice(0, 12)}...).`);
      setLocationName('');
      setLat('');
      setLon('');
      refreshEvents(updated);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create subscription on server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSub = async (id) => {
    try {
      await orcaApi.deleteAlertSubscription(id);
    } catch (err) {
      console.warn(`Server deactivate error for ${id}:`, err.message);
    }
    const updated = subscriptions.filter((s) => s.subscription_id !== id);
    setSubscriptions(updated);
    saveStoredSubscriptions(updated);
    refreshEvents(updated);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4 sm:py-6 px-3 sm:px-4">
      
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Bell className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Section 70: Proactive Maritime Alerts
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Register automated monitoring for adverse weather, extreme swell, lightning, and official IMD/INCOIS bulletins. Alerts deliver via Web Push and in-app directive logs.
          </p>
          <div className="text-[11px] font-mono text-slate-500 mt-2">
            Subscriber ID: <span className="text-cyan-400">{subscriberId}</span>
          </div>
        </div>

        {/* Web Push Status Badge */}
        <div className="flex flex-col items-start md:items-end gap-2">
          {webPushConfig.checked && (
            webPushConfig.enabled ? (
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-800/80 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Web Push Server Ready</span>
              </span>
            ) : (
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-3 py-1.5 rounded-xl border border-amber-800/80 flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Web Push: VAPID Not Configured</span>
              </span>
            )
          )}
        </div>
      </div>

      {/* Web Push Setup Notice if server lacks VAPID */}
      {webPushConfig.checked && !webPushConfig.enabled && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/50 flex items-start space-x-3 text-xs text-amber-300">
          <Info className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-200">Notice on Web Push Delivery</p>
            <p className="mt-1 text-slate-300 leading-relaxed">
              The server host currently does not have VAPID credentials set in its environment (<code className="font-mono text-amber-400">VAPID_PUBLIC_KEY</code>). Alert subscriptions will be stored on the server and verified against incoming hazards, with events appearing in the live directive inbox below. To receive native browser push popups when the browser is closed, operator VAPID keys must be configured.
            </p>
          </div>
        </div>
      )}

      {/* Browser Push Registration Prompt if VAPID available */}
      {webPushConfig.checked && webPushConfig.enabled && !pushSubPayload && (
        <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3 text-cyan-200">
            <Zap className="w-5 h-5 text-cyan-400 flex-shrink-0" />
            <div>
              <div className="font-bold text-white">Enable Browser Push Notifications</div>
              <div className="text-slate-300 text-[11px]">Receive real-time hazard popups even when ORCA is running in the background.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnableWebPush}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs whitespace-nowrap transition-colors cursor-pointer"
          >
            Enable Device Push
          </button>
        </div>
      )}

      {/* Feedback alerts */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Subscription Form */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 backdrop-blur-md">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center space-x-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Configure Alert Subscription</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400 font-mono">POST /alerts/subscriptions</span>
          </div>

          <form onSubmit={handleSaveSubscription} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Monitored Place Name
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g. Kochi Harbor, Visakhapatnam Port"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Coordinates */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Or Coordinate (Optional if place given)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="Latitude (e.g. 10.0)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <input
                  type="number"
                  step="any"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="Longitude (e.g. 76.26)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Threshold Severity */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Minimum Notification Level (§70.4)
              </label>
              <select
                value={minLevel}
                onChange={(e) => setMinLevel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="CAUTION">🟡 CAUTION (Notify for moderate swell, cautionary bulletins)</option>
                <option value="UNSAFE">🟠 UNSAFE (Notify for hazardous waves, gale winds, or squall)</option>
                <option value="DANGEROUS">🔴 DANGEROUS ONLY (Severe cyclone, extreme sea state only)</option>
              </select>
            </div>

            {/* Alert Categories */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Monitored Hazard Types (§70.3)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {ALERT_TYPE_OPTIONS.map(({ key, label, icon }) => (
                  <label key={key} className="flex items-center space-x-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedTypes[key])}
                      onChange={() => handleToggleType(key)}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-slate-300 text-[11px] truncate">{icon} {label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Quiet Hours */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Quiet Hours (Optional, e.g. 22:00 to 06:00)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  placeholder="Start (HH:MM)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <input
                  type="text"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  placeholder="End (HH:MM)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400">
              <span className="font-bold text-amber-400">Safety Rule: </span>
              <span>Official DANGEROUS directives always override quiet hours to safeguard seafarers at sea.</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              {submitting ? 'Registering...' : 'Save Active Subscription'}
            </button>
          </form>
        </div>

        {/* Right Column: Active Subscriptions & Real Event Log */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Active Subscriptions List */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Subscriptions ({subscriptions.length})
              </h3>
              <button
                type="button"
                onClick={() => refreshEvents(subscriptions)}
                className="text-xs text-slate-400 hover:text-cyan-400 flex items-center space-x-1 cursor-pointer"
                title="Refresh events"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${eventsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {subscriptions.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs rounded-2xl bg-slate-950/40 border border-slate-800/60">
                No active alert subscriptions registered. Use the configuration form to monitor a coastal sector.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {subscriptions.map((s) => (
                  <div key={s.subscription_id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white flex items-center space-x-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="truncate">{s.location_label}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                          s.minimum_level === 'DANGEROUS' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                          s.minimum_level === 'UNSAFE' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                          'bg-yellow-950 text-yellow-300 border border-yellow-800'
                        }`}>
                          {s.minimum_level}+
                        </span>
                        <span>{s.alert_types?.length || 0} hazard types</span>
                        <span>•</span>
                        <span className="font-mono text-slate-500">{new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSub(s.subscription_id)}
                      className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-950 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer flex-shrink-0"
                      title="Deactivate subscription"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real Directive Events Inbox */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>Delivered Directive Events ({events.length})</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-500">Live Worker Log</span>
            </div>

            {eventsLoading ? (
              <div className="p-6 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Checking subscription event logs...</span>
              </div>
            ) : events.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs rounded-2xl bg-slate-950/40 border border-slate-800/60">
                No alert events triggered for your active subscriptions yet. When metocean hazards or official bulletins cross your configured threshold, they will be logged here.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {events.map((item, idx) => {
                  const isDangerous = item.level === 'DANGEROUS' || item.severity === 'DANGEROUS';
                  return (
                    <div
                      key={item.event_id || item._id || idx}
                      className={`p-3.5 rounded-2xl border ${
                        isDangerous
                          ? 'bg-rose-950/40 border-rose-900/60'
                          : 'bg-amber-950/40 border-amber-900/60'
                      } space-y-1.5`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          isDangerous ? 'bg-rose-900 text-rose-200' : 'bg-amber-900 text-amber-200'
                        }`}>
                          {item.level || item.severity || 'ALERT'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.created_at ? new Date(item.created_at).toLocaleTimeString() : 'Recent'}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-1">
                        {item.title || item.alert_type || 'Maritime Safety Directive'}
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {item.message || item.text || item.summary || JSON.stringify(item)}
                      </p>
                      {item.subscription_label && (
                        <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-cyan-400" />
                          <span>Sector: {item.subscription_label}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
