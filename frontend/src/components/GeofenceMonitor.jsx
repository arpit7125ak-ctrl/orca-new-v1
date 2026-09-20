import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Navigation, 
  AlertTriangle, 
  MapPin, 
  Compass, 
  Radio, 
  CheckCircle2,
  Loader2 
} from 'lucide-react';
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

  const presets = [
    { name: 'Kochi Coastal (Safe Territorial Waters)', lat: '9.93', lon: '76.10', heading: '270', speed: '8.0' },
    { name: 'Palk Bay (Sri Lanka IMBL Breach)', lat: '9.35', lon: '79.55', heading: '090', speed: '12.0' },
    { name: 'Gulf of Mannar Marine National Park', lat: '9.15', lon: '79.10', heading: '180', speed: '7.5' },
    { name: 'Mumbai High (ONGC ODAG 500m Exclusion)', lat: '19.42', lon: '71.33', heading: '320', speed: '9.5' },
  ];

  const handleCheck = async (e) => {
    if (e) e.preventDefault();
    setIsChecking(true);
    setError(null);

    try {
      const res = await orcaApi.checkGeofence({
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        vessel_type: vesselType,
        device_id: 'vessel_gps_unit_01',
      });
      setResult(res);
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
  };

  const isInside = result?.state === 'INSIDE_EXCLUSION';
  const isApproaching = result?.state === 'APPROACHING_EXCLUSION';
  const isSafe = result?.state === 'CLEAR' || (!isInside && !isApproaching);

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
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping-slow" />
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
              Sensor Feed Live
            </span>
          </div>
        </div>

        {/* Preset Locations */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-2">Test Scenarios:</span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(p)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all"
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  required
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  required
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Vessel Type</label>
              <select
                value={vesselType}
                onChange={(e) => setVesselType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
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
            <div className="py-16 text-center text-slate-500 space-y-2">
              <ShieldCheck className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-xs">Click "Scan Boundary & Zone Proximity" or pick a scenario above to test.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
                isInside
                  ? 'bg-rose-950/60 border-rose-500 text-rose-200 ring-2 ring-rose-500/30 animate-pulse'
                  : isApproaching
                  ? 'bg-amber-950/50 border-amber-500/60 text-amber-200'
                  : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              }`}>
                {isInside ? (
                  <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
                ) : isApproaching ? (
                  <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider">
                    {isInside
                      ? 'CRITICAL: INSIDE PROHIBITED MARITIME BOUNDARY'
                      : isApproaching
                      ? 'WARNING: APPROACHING RESTRICTED EXCLUSION ZONE'
                      : 'CLEAR: SAFE DOMESTIC WATERS'}
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed text-slate-200 font-medium">
                    {result.warning_text ||
                      (isSafe
                        ? 'Vessel GPS coordinate is operating safely within authorized Indian waters with no restricted maritime boundaries breached.'
                        : 'Action required: alter course immediately to avoid crossing surveyed boundary lines.')}
                  </p>
                </div>
              </div>

              {/* Real Telemetry to Boundary Line */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Boundary / Zone Target</span>
                  <span className="text-xs font-bold text-cyan-400 truncate block mt-0.5" title={result.layer_name || 'Mainland Indian Waters'}>
                    {result.layer_name || 'Mainland Indian Waters'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5 capitalize">
                    {result.constraint_type ? result.constraint_type.replace(/_/g, ' ') : 'Open Navigation'}
                  </span>
                </div>

                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Distance to Line</span>
                  <span className={`text-base font-black font-mono mt-0.5 block ${isInside ? 'text-rose-400' : isApproaching ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {isInside
                      ? '0.0 km (BREACH)'
                      : result.distance_km !== null && result.distance_km !== undefined
                      ? `${result.distance_km} km`
                      : '> 50.0 km (Clear)'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {isInside ? 'Vessel is inside boundary' : isApproaching ? 'Within safety buffer' : 'Safe separation maintained'}
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
                    : 'NORMAL NAVIGATION: Safe to operate authorized fishing gear and vessel navigation in current quadrant. Continue monitoring VHF channel 16.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
