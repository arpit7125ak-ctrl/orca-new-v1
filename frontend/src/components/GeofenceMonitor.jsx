import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Navigation, 
  AlertTriangle, 
  MapPin, 
  Compass, 
  Radio, 
  CheckCircle2,
  Loader2,
  Volume2,
  VolumeX,
  Play,
  Square,
  Layers,
  Globe,
  Crosshair,
  Info
} from 'lucide-react';
import L from 'leaflet';
import { orcaApi } from '../api/client';

function getDeviceId() {
  if (typeof window === 'undefined') return 'dev-standalone';
  try {
    let id = localStorage.getItem('ORCA_DEVICE_ID');
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('ORCA_DEVICE_ID', id);
    }
    return id;
  } catch {
    return 'dev-ephemeral';
  }
}

export default function GeofenceMonitor() {
  const [deviceId] = useState(getDeviceId);
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [speedKnots, setSpeedKnots] = useState('');
  const [headingDeg, setHeadingDeg] = useState('');
  const [vesselType, setVesselType] = useState('motorized_country_craft');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Real GPS tracking state
  const [isTrackingGps, setIsTrackingGps] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const watchIdRef = useRef(null);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapLayerRef = useRef(null);

  // Honest reference test scenarios
  const presets = [
    { name: '🟢 Authorized Coastal Waters (Kochi Coast)', lat: '9.93', lon: '76.26' },
    { name: '🟡 Near Gahirmatha Marine Sanctuary (~2 km)', lat: '20.73', lon: '87.08' },
    { name: '🔴 Near Gulf of Mannar Protected Boundary', lat: '9.15', lon: '79.10' },
    { name: '🔴 Approaching Palk Bay Maritime Boundary', lat: '9.35', lon: '79.55' },
    { name: '🌐 Outside Indian EEZ / High Seas', lat: '5.00', lon: '60.00' },
  ];

  // Play synthetic marine alarm chime
  const triggerAudioAlert = (stateStr) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (stateStr === 'inside') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.35);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.7);
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
          osc.start();
          osc.stop(ctx.currentTime + 1.0);
        } else if (stateStr === 'approaching') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
      }

      if ((stateStr === 'inside' || stateStr === 'approaching') && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(
          stateStr === 'inside'
            ? 'Warning: Prohibited maritime boundary breach detected.'
            : 'Advisory: Approaching restricted maritime zone.'
        );
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // Audio autoplay policy catch
    }
  };

  const handleCheck = useCallback(async (customLat = null, customLon = null) => {
    const queryLat = customLat !== null ? customLat : parseFloat(lat);
    const queryLon = customLon !== null ? customLon : parseFloat(lon);

    if (isNaN(queryLat) || isNaN(queryLon)) {
      setError('Please provide valid vessel coordinates (Latitude & Longitude) or click on the map.');
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const res = await orcaApi.checkGeofence({
        lat: queryLat,
        lon: queryLon,
        vessel_type: vesselType || undefined,
        device_id: deviceId,
      });
      setResult(res);

      const stateStr = (res.state || '').toLowerCase();
      triggerAudioAlert(stateStr);
    } catch (err) {
      setError(err.message || 'Failed to check geofence boundary.');
    } finally {
      setIsChecking(false);
    }
  }, [lat, lon, vesselType, deviceId]);

  // Real GPS tracking handler using navigator.geolocation
  const toggleGpsTracking = () => {
    if (isTrackingGps) {
      // Stop tracking
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTrackingGps(false);
      setGpsError(null);
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported in this browser.');
      return;
    }

    setGpsError(null);
    setIsTrackingGps(true);

    const successHandler = (position) => {
      const coords = position.coords;
      const cLat = Number(coords.latitude.toFixed(4));
      const cLon = Number(coords.longitude.toFixed(4));
      setLat(cLat.toString());
      setLon(cLon.toString());

      if (coords.speed !== null && !isNaN(coords.speed)) {
        // speed in m/s converted to knots: 1 m/s = 1.94384 knots
        const knots = (coords.speed * 1.94384).toFixed(1);
        setSpeedKnots(knots);
      } else {
        setSpeedKnots('');
      }

      if (coords.heading !== null && !isNaN(coords.heading)) {
        setHeadingDeg(Math.round(coords.heading).toString());
      } else {
        setHeadingDeg('');
      }

      handleCheck(cLat, cLon);
    };

    const errorHandler = (err) => {
      let msg = 'Failed to acquire device location.';
      if (err.code === 1) { // PERMISSION_DENIED
        msg = 'Location permission denied. Please allow GPS access in your browser settings to track vessel position.';
      } else if (err.code === 2) { // POSITION_UNAVAILABLE
        msg = 'GPS signal unavailable. Device could not acquire a reliable satellite fix.';
      } else if (err.code === 3) { // TIMEOUT
        msg = 'GPS position request timed out. Awaiting satellite signal...';
      }
      setGpsError(msg);
      setIsTrackingGps(false);
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(successHandler, errorHandler, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      });
    } catch (err) {
      setGpsError(`Geolocation error: ${err.message}`);
      setIsTrackingGps(false);
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleApplyPreset = (p) => {
    setLat(p.lat);
    setLon(p.lon);
    handleCheck(parseFloat(p.lat), parseFloat(p.lon));
  };

  const normState = (result?.state || '').toLowerCase();
  const isInside = normState === 'inside';
  const isApproaching = normState === 'approaching';
  const nLat = parseFloat(lat);
  const nLon = parseFloat(lon);
  const isInIndianDomain = Number.isFinite(nLat) && Number.isFinite(nLon) &&
    nLat >= 4.0 && nLat <= 25.0 && nLon >= 65.0 && nLon <= 96.0;
  const isOutsideEEZ = !isInIndianDomain || Boolean(result?.layer_name && result.layer_name.includes('Beyond Indian EEZ'));
  const isSafe = normState === 'clear' && !isOutsideEEZ;

  // Check if layer is tagged approximate
  const isApproximateLayer = Boolean(
    result?.layer_name && (
      result.layer_name.toLowerCase().includes('approximate') ||
      result.layer_name.toLowerCase().includes('unverified')
    )
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [12.0, 78.5],
      zoom: 6,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapLayerRef.current = group;

    map.on('click', (e) => {
      const clickLat = Number(e.latlng.lat.toFixed(4));
      const clickLon = Number(e.latlng.lng.toFixed(4));
      setLat(clickLat.toString());
      setLon(clickLon.toString());
      handleCheck(clickLat, clickLon);
    });

    mapInstanceRef.current = map;

    map.whenReady(() => {
      map.invalidateSize();
    });
    const t = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(t);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [handleCheck]);

  // Update map markers when telemetry changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = mapLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const currLat = parseFloat(lat);
    const currLon = parseFloat(lon);

    if (!Number.isFinite(currLat) || !Number.isFinite(currLon)) {
      return;
    }

    map.setView([currLat, currLon], 10);
    map.invalidateSize();

    // Vessel Marker
    const vesselColor = isInside 
      ? '#f43f5e' 
      : isApproaching 
      ? '#f59e0b' 
      : '#10b981';

    L.circleMarker([currLat, currLon], {
      radius: 9,
      fillColor: vesselColor,
      color: '#ffffff',
      weight: 2.5,
      fillOpacity: 0.95,
    }).bindPopup(`<b>Vessel Position:</b><br>${currLat}°N, ${currLon}°E<br><b>Status:</b> ${normState.toUpperCase() || 'STANDBY'}`).addTo(group);

    // 5 km warning perimeter ring
    L.circle([currLat, currLon], {
      radius: 5000,
      color: isInside ? '#f43f5e' : isApproaching ? '#f59e0b' : '#06b6d4',
      weight: 1.5,
      dashArray: isApproximateLayer ? '3, 6' : '6, 6',
      fillOpacity: isInside ? 0.15 : isApproaching ? 0.08 : 0.02,
    }).addTo(group);

    const hasValidBearing = typeof result?.bearing_deg === 'number' && Number.isFinite(result.bearing_deg);
    const hasValidDistance = typeof result?.distance_km === 'number' && Number.isFinite(result.distance_km);

    if (result && hasValidBearing && hasValidDistance && result.distance_km > 0) {
      const rad = (result.bearing_deg * Math.PI) / 180;
      const cosLat = Math.cos((currLat * Math.PI) / 180);
      const hazLat = currLat + (result.distance_km / 111) * Math.cos(rad);
      const hazLon = Math.abs(cosLat) > 0.0001
        ? currLon + (result.distance_km / (111 * cosLat)) * Math.sin(rad)
        : currLon;

      if (Number.isFinite(hazLat) && Number.isFinite(hazLon)) {
        L.circleMarker([hazLat, hazLon], {
          radius: 6,
          fillColor: isApproximateLayer ? '#f59e0b' : '#ef4444',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.9,
        }).bindPopup(`<b>Barrier Target:</b><br>${result.layer_name || 'Restricted Boundary'}`).addTo(group);

        L.polyline([[currLat, currLon], [hazLat, hazLon]], {
          color: isApproximateLayer ? '#f59e0b' : '#f43f5e',
          weight: 2.5,
          dashArray: isApproximateLayer ? '4, 4' : '8, 4',
        }).addTo(group);
      }
    }
  }, [lat, lon, result, isInside, isApproaching, normState, isApproximateLayer]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-6 h-6 text-cyan-400" />
              <h2 className="text-lg sm:text-xl font-black text-white">
                Section 66: Autonomous Geofence & Boundary Sentinel
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Deterministic spatial screening for maritime protected areas, international maritime boundaries, and marine national parks. Response under 1 second without LLM hallucination.
            </p>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Device Client ID: <span className="text-cyan-400">{deviceId}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Siren Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title="Toggle Audio Alerts"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                soundEnabled 
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/80 hover:bg-cyan-900/50' 
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
              <span>{soundEnabled ? 'Audio: ON' : 'Audio: OFF'}</span>
            </button>

            {/* Real Device GPS Tracking */}
            <button
              type="button"
              onClick={toggleGpsTracking}
              title="Toggle Real Device GPS Tracking"
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isTrackingGps 
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 animate-pulse' 
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-cyan-500 hover:text-white'
              }`}
            >
              <Crosshair className={`w-3.5 h-3.5 ${isTrackingGps ? 'text-emerald-400 animate-spin' : 'text-cyan-400'}`} />
              <span>{isTrackingGps ? 'Tracking Device GPS' : 'Track Device GPS'}</span>
            </button>
          </div>
        </div>

        {/* GPS Error Banner */}
        {gpsError && (
          <div className="mt-4 p-3 rounded-xl bg-amber-950/50 border border-amber-800/70 text-amber-200 text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-amber-300">Device GPS Unavailable: </span>
              <span>{gpsError}</span>
            </div>
          </div>
        )}

        {/* Test Scenarios */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1">Sample Scenarios:</span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Controls Form */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 backdrop-blur-md">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Navigation className="w-4 h-4 text-cyan-400" />
            <span>Vessel Coordinate Input</span>
          </h3>

          <form onSubmit={(e) => { e.preventDefault(); handleCheck(); }} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Latitude (°N)</label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="e.g. 12.50"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Longitude (°E)</label>
                <input
                  type="number"
                  step="any"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="e.g. 74.80"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Speed (Knots)</label>
                <input
                  type="text"
                  readOnly={isTrackingGps}
                  value={speedKnots || (isTrackingGps ? 'Unavailable' : '')}
                  onChange={(e) => setSpeedKnots(e.target.value)}
                  placeholder="Manual or GPS"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Heading (°)</label>
                <input
                  type="text"
                  readOnly={isTrackingGps}
                  value={headingDeg || (isTrackingGps ? 'Unavailable' : '')}
                  onChange={(e) => setHeadingDeg(e.target.value)}
                  placeholder="Manual or GPS"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Vessel Type (§7.7)</label>
              <select
                value={vesselType}
                onChange={(e) => setVesselType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="motorized_country_craft">Motorized Country Craft (FRP/Wood)</option>
                <option value="traditional_non_motorized">Traditional Non-Motorized Boat</option>
                <option value="mechanized_fishing_vessel">Mechanized Fishing Trawler</option>
                <option value="recreational_boat">Recreational Craft</option>
                <option value="large_commercial_vessel">Large Commercial Vessel</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isChecking}
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
            >
              {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
              <span>{isChecking ? 'Verifying Boundary...' : 'Scan Boundary Proximity'}</span>
            </button>
          </form>

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results Overview */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 backdrop-blur-md">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Boundary Analysis Status</span>
          </h3>

          {!result ? (
            <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-950/40 text-center text-slate-400 space-y-1.5">
              <ShieldCheck className="w-7 h-7 mx-auto text-cyan-400" />
              <h4 className="text-xs font-bold text-slate-300">Sentinel Standby</h4>
              <p className="text-[11px] text-slate-500">
                Enter coordinates, click on the map, or activate device GPS to inspect active territorial and conservation boundaries.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className={`p-4 rounded-2xl border flex items-start space-x-3 ${
                isInside
                  ? isApproximateLayer
                    ? 'bg-amber-950/70 border-dashed border-2 border-amber-500 text-amber-200'
                    : 'bg-rose-950/70 border-rose-500 text-rose-100 ring-2 ring-rose-500/40'
                  : isApproaching
                  ? 'bg-amber-950/50 border-amber-500/60 text-amber-200'
                  : isOutsideEEZ
                  ? 'bg-sky-950/60 border-sky-500/60 text-sky-200'
                  : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              }`}>
                {isInside ? (
                  <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
                ) : isApproaching ? (
                  <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                ) : isOutsideEEZ ? (
                  <Globe className="w-6 h-6 text-sky-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                      {isInside
                        ? isApproximateLayer
                          ? 'APPROACHING APPROXIMATE BOUNDARY (UNVERIFIED)'
                          : 'CRITICAL: PROHIBITED BOUNDARY BREACH'
                        : isApproaching
                        ? 'WARNING: WITHIN SAFETY BUFFER OF RESTRICTED AREA'
                        : isOutsideEEZ
                        ? 'ADVISORY: OUTSIDE INDIAN EXCLUSIVE ECONOMIC ZONE'
                        : 'CLEAR: SAFE OPERATIONAL WATERS'}
                    </h4>

                    {isApproximateLayer && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900/80 text-amber-200 border border-amber-700">
                        Approximate Source
                      </span>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed text-slate-200">
                    {result.warning_text ||
                      (isSafe
                        ? 'Vessel coordinates operate safely within Indian domestic waters with no restricted boundary violations.'
                        : isOutsideEEZ
                        ? `Coordinate (${lat}°N, ${lon}°E) is outside sovereign Indian territorial waters. Domestic artisanal permits do not apply.`
                        : 'Action required: evaluate heading to avoid crossing demarcated boundary lines.')}
                  </p>

                  {result.deduplicated && (
                    <div className="mt-1.5 inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                      <span>Deduplicated (cooldown window active)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Real Telemetry row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Boundary Layer</span>
                  <span className="text-xs font-bold text-cyan-400 truncate block mt-0.5" title={result.layer_name || 'Domestic Waters'}>
                    {result.layer_name || 'Domestic Waters (EEZ)'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5 capitalize">
                    {result.constraint_type ? result.constraint_type.replace(/_/g, ' ') : 'Unrestricted Navigation'}
                  </span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Separation Distance</span>
                  <span className={`text-sm sm:text-base font-black font-mono mt-0.5 block ${isInside ? 'text-rose-400' : isApproaching ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {isInside
                      ? '0.0 km (Breach)'
                      : result.distance_km !== null && result.distance_km !== undefined
                      ? `${result.distance_km} km`
                      : '> 50.0 km (Clear)'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {isInside ? 'Inside boundary perimeter' : isApproaching ? 'Within 5km warning buffer' : 'Safe separation'}
                  </span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Relative Bearing</span>
                  <span className="text-sm sm:text-base font-black text-blue-400 font-mono mt-0.5 block">
                    {result.bearing_deg !== null && result.bearing_deg !== undefined ? `${result.bearing_deg}°` : '—'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {result.bearing_deg !== null && result.bearing_deg !== undefined ? 'Relative angle to barrier' : 'No barrier in perimeter'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Radar Mini-Map */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Boundary Radar View</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Click map to select coordinate
              </span>
            </div>
            <div className="relative h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-800 shadow-inner bg-slate-950">
              <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />
              <div className="absolute bottom-2 left-2 z-[400] bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-[10px] text-slate-300 pointer-events-none flex items-center space-x-2">
                {Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lon)) ? (
                  <>
                    <span>
                      {isInside ? '🔴 Inside Boundary' : isApproaching ? '🟡 Approaching (5km Buffer)' : '🟢 Domestic Waters'}
                    </span>
                    {result?.bearing_deg !== null && result?.bearing_deg !== undefined && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-400 font-mono">Bearing: {result.bearing_deg}°</span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-cyan-400">
                    Click anywhere on the map or enter coordinates above
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
