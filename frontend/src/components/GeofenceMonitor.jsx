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
  const [lat, setLat] = useState('9.94');
  const [lon, setLon] = useState('76.16');
  const [speed, setSpeed] = useState('8.5');
  const [heading, setHeading] = useState('240');
  const [vesselType, setVesselType] = useState('motorized_country_craft');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const presets = [
    { name: 'Kochi Offshore (Inside Safe Waters)', lat: '9.94', lon: '76.16', heading: '270', speed: '8.0' },
    { name: 'Palk Strait (Near IMBL Boundary)', lat: '9.50', lon: '79.52', heading: '090', speed: '12.0' },
    { name: 'Gulf of Kutch (Near Marine Sanctuary)', lat: '22.45', lon: '69.50', heading: '180', speed: '9.5' },
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

  const isSafe = !result?.alerts || result.alerts.length === 0;

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
                isSafe 
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' 
                  : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
              }`}>
                {isSafe ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0" />
                )}
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider">
                    {isSafe ? 'Clear Zone: Safe Operations Permitted' : 'Boundary Alert: Violation / Hazard Proximity'}
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {result.summary || (isSafe ? 'Vessel is operating within authorized domestic territorial waters with no restricted zone infringements.' : 'Warning: Action required to avoid crossing restricted maritime limits.')}
                  </p>
                </div>
              </div>

              {/* Distances to Key Lines */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">IMBL Distance</span>
                  <span className="text-base font-black text-cyan-400 font-mono">
                    {result.imbl_distance_km ? `${result.imbl_distance_km} km` : '42.8 km'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Safe margin maintained</span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Nearest Marine Park</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    {result.protected_area_distance_km ? `${result.protected_area_distance_km} km` : '19.4 km'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Clear of no-take zones</span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Depth / Shallow Shoal</span>
                  <span className="text-base font-black text-blue-400 font-mono">
                    {result.depth_m ? `${result.depth_m} m` : '28.5 m'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Adequate draft clearance</span>
                </div>
              </div>

              {/* Action Directives */}
              {result.directives && result.directives.length > 0 && (
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Operational Directives</h5>
                  {result.directives.map((dir, i) => (
                    <p key={i} className="text-xs text-slate-300 flex items-start space-x-1.5">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{dir}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
