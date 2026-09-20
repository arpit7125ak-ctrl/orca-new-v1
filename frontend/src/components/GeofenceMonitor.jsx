import React, { useState, useEffect, useRef } from 'react';
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
  Globe
} from 'lucide-react';
import L from 'leaflet';
import { orcaApi } from '../api/client';

export default function GeofenceMonitor() {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [speed, setSpeed] = useState('');
  const [heading, setHeading] = useState('');
  const [vesselType, setVesselType] = useState('motorized_country_craft');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapLayerRef = useRef(null);
  const simulationTimerRef = useRef(null);

  const presets = [
    { name: '🟢 Safe Waters (Kochi Coast)', lat: '9.94', lon: '76.16', heading: '270', speed: '8.0' },
    { name: '🟡 Approaching Exclusion (1 km from Gahirmatha)', lat: '20.85', lon: '87.16', heading: '260', speed: '9.0' },
    { name: '🔴 Inside Boundary (Sri Lanka IMBL Breach)', lat: '9.35', lon: '79.55', heading: '090', speed: '12.0' },
    { name: '🔴 Inside Protected Park (Gulf of Mannar)', lat: '9.15', lon: '79.10', heading: '180', speed: '7.5' },
    { name: '🔴 Inside Oil Rig (Mumbai High 500m)', lat: '19.42', lon: '71.33', heading: '320', speed: '9.5' },
  ];

  // Play synthetic marine alarm chimes and speech synthesis
  const triggerAudioAlert = (stateStr, warningText) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (stateStr === 'inside') {
          // Dual-tone urgent nautical emergency siren
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.35);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.7);
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
          osc.start();
          osc.stop(ctx.currentTime + 1.0);
        } else if (stateStr === 'approaching') {
          // Single pulse warning chime
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
      }

      // Voice synthesiser alert if approaching/inside
      if ((stateStr === 'inside' || stateStr === 'approaching') && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(
          stateStr === 'inside'
            ? 'Warning! Boundary violation detected. Alter course immediately.'
            : 'Advisory. Approaching maritime exclusion zone.'
        );
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  };

  const handleCheck = async (e, customLat = null, customLon = null) => {
    if (e) e.preventDefault();
    const queryLat = customLat !== null ? customLat : parseFloat(lat);
    const queryLon = customLon !== null ? customLon : parseFloat(lon);

    if (isNaN(queryLat) || isNaN(queryLon)) {
      setError('Please enter valid vessel Latitude & Longitude, select a test scenario, or click on the map.');
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const res = await orcaApi.checkGeofence({
        lat: queryLat,
        lon: queryLon,
        vessel_type: vesselType,
        device_id: 'vessel_gps_unit_01',
      });
      setResult(res);

      const stateStr = (res.state || '').toLowerCase();
      triggerAudioAlert(stateStr, res.warning_text);
    } catch (err) {
      setError(err.message || 'Failed to check geofence boundary');
    } finally {
      setIsChecking(false);
    }
  };

  const handleApplyPreset = (p) => {
    setLat(p.lat);
    setLon(p.lon);
    setHeading(p.heading);
    setSpeed(p.speed);
    handleCheck(null, parseFloat(p.lat), parseFloat(p.lon));
  };

  // Live simulation ticker: drifts boat forward in heading direction
  useEffect(() => {
    if (!isSimulating) {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
      return;
    }

    simulationTimerRef.current = setInterval(() => {
      setLat((prevLat) => {
        const curLat = parseFloat(prevLat) || 9.25;
        const curHeading = parseFloat(heading) || 90;
        const curSpeed = parseFloat(speed) || 10;
        // ~0.003 deg drift per tick
        const dLat = (curSpeed / 3600) * Math.cos((curHeading * Math.PI) / 180) * 4;
        const nextLat = Number((curLat + dLat).toFixed(4));
        setLon((prevLon) => {
          const curLon = parseFloat(prevLon) || 79.40;
          const dLon = (curSpeed / 3600) * Math.sin((curHeading * Math.PI) / 180) * 4;
          const nextLon = Number((curLon + dLon).toFixed(4));
          handleCheck(null, nextLat, nextLon);
          return nextLon.toString();
        });
        return nextLat.toString();
      });
    }, 3500);

    return () => {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
    };
  }, [isSimulating, heading, speed, vesselType]);

  const normState = (result?.state || '').toLowerCase();
  const isInside = normState === 'inside' || normState === 'inside_exclusion';
  const isApproaching = normState === 'approaching' || normState === 'approaching_exclusion';
  const nLat = parseFloat(lat);
  const nLon = parseFloat(lon);
  const isInIndianDomain = Number.isFinite(nLat) && Number.isFinite(nLon) &&
    nLat >= 4.0 && nLat <= 25.0 && nLon >= 65.0 && nLon <= 96.0;
  const isOutsideEEZ = !isInIndianDomain || Boolean(result?.layer_name && result.layer_name.includes('Beyond Indian EEZ'));
  const isSafe = normState === 'clear' && !isOutsideEEZ;

  // Initialize Leaflet Map ONCE on mount with robust size invalidation and ResizeObserver
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [12.0, 78.5], // Center of South Indian maritime waters
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

    // Allow clicking mini-map to drop boat anywhere
    map.on('click', (e) => {
      const clickLat = Number(e.latlng.lat.toFixed(4));
      const clickLon = Number(e.latlng.lng.toFixed(4));
      setLat(clickLat.toString());
      setLon(clickLon.toString());
      handleCheck(null, clickLat, clickLon);
    });

    mapInstanceRef.current = map;

    // Multi-tier invalidateSize calls to ensure full container rendering without grey patches
    map.whenReady(() => {
      map.invalidateSize();
    });
    const t1 = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 120);
    const t2 = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 350);

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (resizeObserver) resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Vessel Marker, Warning Ring & Bearing Vectors whenever telemetry updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = mapLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const nLat = parseFloat(lat);
    const nLon = parseFloat(lon);

    if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) {
      return;
    }

    // Pan smoothly to the vessel's coordinates
    map.setView([nLat, nLon], 10);
    map.invalidateSize();

    // Vessel Marker
    const vesselColor = isInside ? '#f43f5e' : isApproaching ? '#f59e0b' : '#10b981';
    L.circleMarker([nLat, nLon], {
      radius: 9,
      fillColor: vesselColor,
      color: '#ffffff',
      weight: 2.5,
      fillOpacity: 0.95,
    }).bindPopup(`<b>Vessel Position:</b><br>${nLat}°N, ${nLon}°E<br><b>Status:</b> ${normState.toUpperCase() || 'STANDBY'}`).addTo(group);

    // 5 km warning buffer ring around vessel
    L.circle([nLat, nLon], {
      radius: 5000,
      color: isInside ? '#f43f5e' : isApproaching ? '#f59e0b' : '#06b6d4',
      weight: 1.5,
      dashArray: '4, 6',
      fillOpacity: isInside ? 0.15 : isApproaching ? 0.1 : 0.03,
    }).addTo(group);

    // Strictly validate bearing and distance numbers to prevent NaN LatLng crashes
    const hasValidBearing = typeof result?.bearing_deg === 'number' && Number.isFinite(result.bearing_deg);
    const hasValidDistance = typeof result?.distance_km === 'number' && Number.isFinite(result.distance_km);

    if (result && hasValidBearing && hasValidDistance && result.distance_km > 0) {
      const rad = (result.bearing_deg * Math.PI) / 180;
      const cosLat = Math.cos((nLat * Math.PI) / 180);
      const hazLat = nLat + (result.distance_km / 111) * Math.cos(rad);
      const hazLon = Math.abs(cosLat) > 0.0001
        ? nLon + (result.distance_km / (111 * cosLat)) * Math.sin(rad)
        : nLon;

      if (Number.isFinite(hazLat) && Number.isFinite(hazLon)) {
        // Hazard Point Marker
        L.circleMarker([hazLat, hazLon], {
          radius: 6,
          fillColor: '#ef4444',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.9,
        }).bindPopup(`<b>Target Hazard:</b><br>${result.layer_name || 'Boundary Barrier'}`).addTo(group);

        // Bearing line
        L.polyline([[nLat, nLon], [hazLat, hazLon]], {
          color: isInside ? '#f43f5e' : '#f59e0b',
          weight: 3,
          dashArray: '6, 6',
        }).addTo(group);
      }
    }
  }, [lat, lon, result, isInside, isApproaching, normState]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-6 h-6 text-cyan-400" />
              <h2 className="text-lg sm:text-xl font-black text-white">
                Autonomous Geofence & Territorial Boundary Guard
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Active proximity screening for International Maritime Boundary Line (IMBL), Marine National Parks, and Navigational Hazards
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Audio Siren Mute Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title="Toggle Audio Siren Alerts"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                soundEnabled 
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/80 hover:bg-cyan-900/50' 
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
              <span>{soundEnabled ? 'Siren: ON' : 'Siren: OFF'}</span>
            </button>

            {/* Live GPS Simulator Toggle */}
            <button
              type="button"
              onClick={() => setIsSimulating(!isSimulating)}
              title="Toggle Live GPS Auto-Ping Simulation"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                isSimulating 
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800 animate-pulse' 
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {isSimulating ? <Square className="w-3.5 h-3.5 text-rose-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isSimulating ? 'Stop Simulator' : 'Live Auto-Ping'}</span>
            </button>

            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <span className={`w-2.5 h-2.5 rounded-full ${isSimulating ? 'bg-rose-400 animate-ping' : 'bg-emerald-400 animate-ping-slow'}`} />
              <span className={`text-xs font-mono font-bold uppercase ${isSimulating ? 'text-rose-400' : 'text-emerald-400'}`}>
                {isSimulating ? 'Simulating' : 'Sensor Live'}
              </span>
            </div>
          </div>
        </div>

        {/* Preset Locations */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-2">Test Scenarios:</span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(p)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Input & Live Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Form */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Navigation className="w-4 h-4 text-cyan-400" />
            <span>Vessel Telemetry Parameters</span>
          </h3>

          <form onSubmit={handleCheck} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Latitude (°N)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="e.g. 9.94"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Longitude (°E)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="e.g. 76.16"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Speed (Knots)</label>
                <input
                  type="number"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                  placeholder="e.g. 8.5"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Heading (°)</label>
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  placeholder="e.g. 240"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Vessel Type</label>
              <select
                value={vesselType}
                onChange={(e) => setVesselType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="motorized_country_craft">Motorized Country Craft (FRP/Wood)</option>
                <option value="traditional_non_motorized">Traditional Non-Motorized Boat</option>
                <option value="mechanized_fishing_vessel">Mechanized Fishing Vessel / Trawler</option>
                <option value="recreational_boat">Recreational Speedboat</option>
                <option value="large_commercial_vessel">Large Commercial Vessel</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isChecking}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
              <span>{isChecking ? 'Checking Geofence...' : 'Scan Boundary & Zone Proximity'}</span>
            </button>
          </form>

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results Overview */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Boundary Analysis Telemetry</span>
          </h3>

          {!result ? (
            <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-950/40 text-center text-slate-400 space-y-1.5">
              <ShieldCheck className="w-6 h-6 mx-auto text-cyan-400" />
              <h4 className="text-xs font-bold text-slate-300">Geofence Radar Active</h4>
              <p className="text-[11px] text-slate-500">
                Click "Scan Boundary & Zone Proximity" or choose a scenario above to test active boundaries.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
                isInside
                  ? 'bg-rose-950/60 border-rose-500 text-rose-200 ring-2 ring-rose-500/30 animate-pulse'
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
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider">
                    {isInside
                      ? 'CRITICAL: INSIDE PROHIBITED MARITIME BOUNDARY'
                      : isApproaching
                      ? 'WARNING: APPROACHING RESTRICTED EXCLUSION ZONE'
                      : isOutsideEEZ
                      ? 'ADVISORY: BEYOND INDIAN MARITIME DOMAIN (EEZ)'
                      : 'CLEAR: SAFE DOMESTIC WATERS'}
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed text-slate-200 font-medium">
                    {result.warning_text ||
                      (isSafe
                        ? 'Vessel GPS coordinate is operating safely within authorized Indian waters with no restricted maritime boundaries breached.'
                        : isOutsideEEZ
                        ? `Vessel coordinate (${lat}°N, ${lon}°E) is outside the Indian Exclusive Economic Zone. Standard Indian domestic coastal fishing permits apply only within sovereign Indian waters.`
                        : 'Action required: alter course immediately to avoid crossing surveyed boundary lines.')}
                  </p>
                </div>
              </div>

              {/* Real Telemetry to Boundary Line */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Boundary / Zone Target</span>
                  <span className="text-xs font-bold text-cyan-400 truncate block mt-0.5" title={result.layer_name || (isOutsideEEZ ? 'Beyond Indian EEZ (Foreign / High Seas)' : 'Mainland Indian Waters (EEZ)')}>
                    {result.layer_name || (isOutsideEEZ ? 'Beyond Indian EEZ (Foreign / High Seas)' : 'Mainland Indian Waters (EEZ)')}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5 capitalize">
                    {isOutsideEEZ ? 'International / Foreign Sector' : (result.constraint_type ? result.constraint_type.replace(/_/g, ' ') : 'Open Domestic Navigation')}
                  </span>
                </div>

                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Distance to Line</span>
                  <span className={`text-base font-black font-mono mt-0.5 block ${isInside ? 'text-rose-400' : isApproaching ? 'text-amber-400' : isOutsideEEZ ? 'text-sky-400' : 'text-emerald-400'}`}>
                    {isInside
                      ? '0.0 km (BREACH)'
                      : isOutsideEEZ
                      ? '> 1,000 km (Ex-EEZ)'
                      : result.distance_km !== null && result.distance_km !== undefined
                      ? `${result.distance_km} km`
                      : '> 50.0 km (Clear)'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {isInside ? 'Vessel is inside boundary' : isApproaching ? 'Within safety buffer' : isOutsideEEZ ? 'Beyond Indian Coast Guard Radar' : 'Safe domestic separation'}
                  </span>
                </div>

                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Bearing to Hazard</span>
                  <span className="text-base font-black text-blue-400 font-mono mt-0.5 block">
                    {result.bearing_deg !== null && result.bearing_deg !== undefined ? `${result.bearing_deg}°` : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {result.bearing_deg !== null && result.bearing_deg !== undefined ? 'Relative angle to barrier' : 'No barrier in heading'}
                  </span>
                </div>
              </div>

              {/* Directive Card */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Safety Action Directive</h5>
                <p className="text-xs text-slate-200">
                  {isInside
                    ? 'IMMEDIATE ACTION REQUIRED: Reverse vessel heading immediately to return to authorized Indian territorial waters. Violations of international maritime boundaries or Marine National Parks carry strict legal penalties under UNCLOS and the Wildlife Protection Act.'
                    : isApproaching
                    ? 'ADVISORY: You are within 5 km of an active maritime boundary or restricted area. Monitor vessel radar and GPS heading; do not set nets or cross demarcated lines.'
                    : isOutsideEEZ
                    ? 'INTERNATIONAL / FOREIGN JURISDICTION ADVISORY: This vessel position is outside the sovereign jurisdiction of Indian Maritime Safety Authorities (MRCC India). Standard Indian domestic coastal fishing permits are valid only within the 200NM Indian EEZ. If operating in international or foreign waters, ensure compliance with UNCLOS international maritime regulations and bilateral foreign clearances.'
                    : 'NORMAL NAVIGATION: Safe to operate authorized fishing gear and vessel navigation in current quadrant. Continue monitoring VHF channel 16.'}
                </p>
              </div>
            </div>
          )}

          {/* Interactive Radar Mini-Map (Permanently mounted) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Live Geofence Radar Canvas</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Click map to inspect any point
              </span>
            </div>
            <div className="relative h-72 sm:h-80 rounded-xl overflow-hidden border border-slate-800 shadow-inner bg-slate-950">
              <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />
              <div className="absolute bottom-2 left-2 z-[400] bg-slate-950/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-300 pointer-events-none flex items-center space-x-2">
                {Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lon)) ? (
                  <>
                    <span>
                      {isInside ? '🔴 Vessel Inside Exclusion' : isApproaching ? '🟡 Approaching Barrier' : isOutsideEEZ ? '🌐 Beyond Indian EEZ' : '🟢 Safe Indian Waters'}
                    </span>
                    <span>•</span>
                    <span>Ring: 5km Safety Perimeter</span>
                    {result?.bearing_deg !== null && result?.bearing_deg !== undefined && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-400 font-semibold">Dashed: Hazard Bearing ({result.bearing_deg}°)</span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-cyan-400 font-medium">
                    🗺️ Standby: Click water to position vessel or select a test scenario above
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
