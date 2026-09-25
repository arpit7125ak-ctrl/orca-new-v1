/**
 * ============================================================================
 * ORCA Maritime Alerts & INCOIS Notification Hub (src/components/AlertsPage.jsx)
 * ============================================================================
 * Real-time coastal hazard alert subscription manager (Page 8).
 * 
 * Capabilities (Architecture Spec §12, §70):
 * 1. Multi-Hazard Subscriptions: Create targeted alerts for cyclones, high waves,
 *    swell surges, squalls, lightning, or official IMD/INCOIS bulletins.
 * 2. Geo-Fenced Monitoring: Subscriptions tether to custom coastal GPS anchors
 *    with a configurable radial buffer (e.g. 25-50 km).
 * 3. Notification Channels: Configurable delivery via browser Web Push notifications
 *    and background telemetry polling.
 * 4. Event History: Real-time inspection of triggered alerts and delivered events.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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

/**
 * Standardized marine alert categories supported by the alert dispatcher.
 */
const ALERT_TYPE_OPTIONS = [
  { key: 'cyclone', labelKey: 'alerts.typeCyclone', icon: '🌀' },
  { key: 'strong_wind', labelKey: 'alerts.typeStrongWind', icon: '💨' },
  { key: 'high_wave', labelKey: 'alerts.typeHighWave', icon: '🌊' },
  { key: 'swell_surge', labelKey: 'alerts.typeSwellSurge', icon: '🌊' },
  { key: 'lightning', labelKey: 'alerts.typeLightning', icon: '⚡' },
  { key: 'thunderstorm', labelKey: 'alerts.typeThunderstorm', icon: '⛈️' },
  { key: 'poor_visibility', labelKey: 'alerts.typePoorVisibility', icon: '🌫️' },
  { key: 'official_warning', labelKey: 'alerts.typeOfficialWarning', icon: '📢' },
  { key: 'other_hazard', labelKey: 'alerts.typeOtherHazard', icon: '⚠️' },
];

/**
 * Alerts & Notification Management Page Component.
 */
export default function AlertsPage() {
  const { t } = useTranslation('ui');

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
  //get or create a unique subscriber ID for this browser session
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
      setErrorMsg(t('alerts.pushNotSupported'));
      return;
    }
    if (!webPushConfig.vapid_public_key) {
      setErrorMsg(t('alerts.noVapidKey'));
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setBrowserPushPermission(permission);
      if (permission !== 'granted') {
        setErrorMsg(t('alerts.permissionDenied'));
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
      setSuccessMsg(t('alerts.pushEnabledSuccess'));
    } catch (err) {
      console.error('Failed to subscribe to Web Push:', err);
      setErrorMsg(`${t('alerts.pushError')}: ${err.message}`);
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
      setErrorMsg(t('alerts.errorSpecifyLocation'));
      return;
    }

    const alertTypesArray = Object.keys(selectedTypes).filter((k) => selectedTypes[k]);
    if (alertTypesArray.length === 0) {
      setErrorMsg(t('alerts.errorSelectHazard'));
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
        location_label: placeName || (hasCoord ? `${latNum.toFixed(2)}°N, ${lonNum.toFixed(2)}°E` : t('alerts.monitoredSector')),
        minimum_level: minLevel,
        alert_types: alertTypesArray,
        channel: 'web_push',
        created_at: res?.created_at || new Date().toISOString(),
        has_push: Boolean(pushSubPayload),
      };

      const updated = [newEntry, ...subscriptions];
      setSubscriptions(updated);
      saveStoredSubscriptions(updated);

      setSuccessMsg(t('alerts.successRegistered', { id: subId.slice(0, 12) }));
      setLocationName('');
      setLat('');
      setLon('');
      refreshEvents(updated);
    } catch (err) {
      setErrorMsg(err.message || t('alerts.errorCreateFailed'));
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
      <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Bell className="w-6 h-6 text-[var(--caution-bright)]" />
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {t('alerts.title')}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-2xl">
            {t('alerts.subtitle')}
          </p>
          <div className="text-[11px] font-mono text-[var(--text-muted)] mt-2">
            {t('alerts.subscriberId')}: <span className="text-[var(--accent-primary)]">{subscriberId}</span>
          </div>
        </div>

        {/* Web Push Status Badge */}
        <div className="flex flex-col items-start md:items-end gap-2">
          {webPushConfig.checked && (
            webPushConfig.enabled ? (
              <span className="text-xs font-mono font-bold text-[var(--safe-bright)] bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-800/80 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('alerts.pushReady')}</span>
              </span>
            ) : (
              <span className="text-xs font-mono font-bold text-[var(--caution-bright)] bg-amber-950/60 px-3 py-1.5 rounded-xl border border-amber-800/80 flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>{t('alerts.pushNotConfigured')}</span>
              </span>
            )
          )}
        </div>
      </div>

      {/* Web Push Setup Notice if server lacks VAPID */}
      {webPushConfig.checked && !webPushConfig.enabled && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/50 flex items-start space-x-3 text-xs text-[var(--caution-bright)]">
          <Info className="w-5 h-5 flex-shrink-0 text-[var(--caution-bright)] mt-0.5" />
          <div>
            <p className="font-semibold text-amber-200">{t('alerts.pushNoticeTitle')}</p>
            <p className="mt-1 text-[var(--text-secondary)] leading-relaxed">
              {t('alerts.pushNoticeBody')}
            </p>
          </div>
        </div>
      )}

      {/* Browser Push Registration Prompt if VAPID available */}
      {webPushConfig.checked && webPushConfig.enabled && !pushSubPayload && (
        <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3 text-cyan-200">
            <Zap className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0" />
            <div>
              <div className="font-bold text-[var(--text-primary)]">{t('alerts.enableBrowserPush')}</div>
              <div className="text-[var(--text-secondary)] text-[11px]">{t('alerts.enableBrowserPushDesc')}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnableWebPush}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-black font-bold rounded-xl text-xs whitespace-nowrap transition-colors cursor-pointer"
          >
            {t('alerts.enableDevicePush')}
          </button>
        </div>
      )}

      {/* Feedback alerts */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-[var(--dangerous-bright)]" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[var(--safe-bright)]" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Subscription Form */}
        <div className="lg:col-span-6 bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-3xl p-6 shadow-xl space-y-4 backdrop-blur-md">
          <div className="border-b border-[var(--border-base)] pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center space-x-2">
              <Plus className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>{t('alerts.configureSubscription')}</span>
            </h3>
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] font-mono">POST /alerts/subscriptions</span>
          </div>

          <form onSubmit={handleSaveSubscription} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                {t('alerts.monitoredPlaceName')}
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[var(--accent-primary)] absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder={t('alerts.locationPlaceholder')}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Coordinates */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                {t('alerts.orCoordinate')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder={t('alerts.latitudePlaceholder')}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <input
                  type="number"
                  step="any"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder={t('alerts.longitudePlaceholder')}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Threshold Severity */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                {t('alerts.minLevelSection')}
              </label>
              <select
                value={minLevel}
                onChange={(e) => setMinLevel(e.target.value)}
                className="w-full bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="CAUTION">{t('alerts.levelCautionDesc')}</option>
                <option value="UNSAFE">{t('alerts.levelUnsafeDesc')}</option>
                <option value="DANGEROUS">{t('alerts.levelDangerousDesc')}</option>
              </select>
            </div>

            {/* Alert Categories */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                {t('alerts.monitoredHazardsSection')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {ALERT_TYPE_OPTIONS.map(({ key, labelKey, icon }) => (
                  <label key={key} className="flex items-center space-x-2 bg-[var(--bg-base)] p-2.5 rounded-xl border border-[var(--border-base)] cursor-pointer hover:border-slate-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedTypes[key])}
                      onChange={() => handleToggleType(key)}
                      className="rounded border-[var(--border-base)] text-[var(--accent-primary)] focus:ring-cyan-500"
                    />
                    <span className="text-[var(--text-secondary)] text-[11px] truncate">{icon} {t(labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Quiet Hours */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                {t('alerts.quietHours')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  placeholder={t('alerts.quietStartPlaceholder')}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <input
                  type="text"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  placeholder={t('alerts.quietEndPlaceholder')}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-base)] text-[11px] text-[var(--text-secondary)]">
              <span className="font-bold text-[var(--caution-bright)]">{t('alerts.safetyRule')}: </span>
              <span>{t('alerts.safetyRuleDesc')}</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:bg-slate-800 disabled:text-slate-500 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-lg cursor-pointer"
            >
              {submitting ? t('alerts.registering') : t('alerts.saveSubscription')}
            </button>
          </form>
        </div>

        {/* Right Column: Active Subscriptions & Real Event Log */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Active Subscriptions List */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-base)] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {t('alerts.activeSubscriptionsCount', { count: subscriptions.length })}
              </h3>
              <button
                type="button"
                onClick={() => refreshEvents(subscriptions)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] flex items-center space-x-1 cursor-pointer"
                title={t('alerts.refreshEvents')}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${eventsLoading ? 'animate-spin' : ''}`} />
                <span>{t('alerts.refresh')}</span>
              </button>
            </div>

            {subscriptions.length === 0 ? (
              <div className="p-6 text-center text-[var(--text-muted)] text-xs rounded-2xl bg-[var(--bg-base)] border border-[var(--border-base)]">
                {t('alerts.noSubscriptionsRegistered')}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {subscriptions.map((s) => (
                  <div key={s.subscription_id} className="p-3.5 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-base)] flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[var(--text-primary)] flex items-center space-x-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)] flex-shrink-0" />
                        <span className="truncate">{s.location_label}</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                          s.minimum_level === 'DANGEROUS' ? 'bg-[var(--dangerous)]/20 text-[var(--dangerous-bright)] border border-[var(--dangerous)]' :
                          s.minimum_level === 'UNSAFE' ? 'bg-[var(--caution)]/20 text-[var(--caution-bright)] border border-[var(--caution)]' :
                          'bg-yellow-950 text-yellow-300 border border-yellow-800'
                        }`}>
                          {s.minimum_level}+
                        </span>
                        <span>{s.alert_types?.length || 0} {t('alerts.hazardTypesCount')}</span>
                        <span>•</span>
                        <span className="font-mono text-[var(--text-muted)]">{new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSub(s.subscription_id)}
                      className="p-2 rounded-lg bg-[var(--bg-surface-2)] hover:bg-rose-950 hover:text-rose-400 text-[var(--text-secondary)] transition-colors cursor-pointer flex-shrink-0"
                      title={t('alerts.deactivateSubscription')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real Directive Events Inbox */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-base)] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center space-x-1.5">
                <Radio className="w-3.5 h-3.5 text-[var(--dangerous-bright)] animate-pulse" />
                <span>{t('alerts.deliveredEventsCount', { count: events.length })}</span>
              </h3>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">{t('alerts.liveWorkerLog')}</span>
            </div>

            {eventsLoading ? (
              <div className="p-6 text-center text-[var(--text-secondary)] text-xs flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                <span>{t('alerts.checkingLogs')}</span>
              </div>
            ) : events.length === 0 ? (
              <div className="p-6 text-center text-[var(--text-muted)] text-xs rounded-2xl bg-[var(--bg-base)] border border-[var(--border-base)]">
                {t('alerts.noEventsTriggered')}
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
                        <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                          {item.created_at ? new Date(item.created_at).toLocaleTimeString() : t('alerts.recent')}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)] mt-1">
                        {item.title || item.alert_type || t('alerts.directiveDefaultTitle')}
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {item.message || item.text || item.summary || JSON.stringify(item)}
                      </p>
                      {item.subscription_label && (
                        <div className="text-[10px] text-[var(--text-secondary)] flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-[var(--accent-primary)]" />
                          <span>{t('alerts.sector')}: {item.subscription_label}</span>
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
