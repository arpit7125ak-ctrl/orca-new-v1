/**
 * ============================================================================
 * ORCA Nautical Route Planner & Passage Analyzer (src/components/RoutePlannerPage.jsx)
 * ============================================================================
 * Nautical passage planning and waypoint risk evaluation interface (Page 9).
 * 
 * Capabilities (Architecture Spec §13, §71):
 * 1. Interactive Passage Definition: Click map to place Departure Harbor (Origin)
 *    and Destination Fishing Grounds (Destination).
 * 2. Great-Circle / Coastal Waypoint Generation: Submits trajectory to /api/v1/route
 *    which splits passage into equidistant offshore waypoints.
 * 3. Waypoint Risk Telemetry: Evaluates environmental risks (wind, swell, restricted zones)
 *    along each intermediate nautical leg.
 * 4. Overall Passage Score: Renders color-coded passage trajectory polyline
 *    (green for SAFE, amber for CAUTION, red for DANGEROUS).
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Navigation, 
  MapPin, 
  Clock, 
  Compass, 
  Ship, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Sparkles,
  ArrowRight,
  RotateCcw,
  MousePointerClick,
  Loader2,
  Calendar,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import L from 'leaflet';
import { orcaApi } from '../api/client';
import { getNearestCoastalPlace } from '../utils/geo';
import { addEntry } from '../utils/history';
import { VESSEL_TYPES } from '../utils/maritimeConfig';

/**
 * Route Planner Component.
 * 
 * @param {Object} props
 * @param {string} [props.selectedLang='auto'] - Active language code for localized advisory output.
 */
export default function RoutePlannerPage({ selectedLang = 'auto' }) {
  const { t } = useTranslation('ui');
  const [originName, setOriginName] = useState('');
  const [destName, setDestName] = useState('');
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [vesselType, setVesselType] = useState(''); // Required input, no default
  const [departureTime, setDepartureTime] = useState('');
  const [targetMode, setTargetMode] = useState('origin'); // 'origin' | 'dest'
  const [isCalculating, setIsCalculating] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [routeResult, setRouteResult] = useState(null);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayerRef = useRef(null);

  const stateRef = useRef({ targetMode, originCoords, destCoords });
  useEffect(() => {
    stateRef.current = { targetMode, originCoords, destCoords };
  }, [targetMode, originCoords, destCoords]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [11.5, 75.5],
      zoom: 7,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const roundedLat = parseFloat(lat.toFixed(4));
      const roundedLon = parseFloat(lng.toFixed(4));
      const place = getNearestCoastalPlace(roundedLat, roundedLon);

      const current = stateRef.current;
      if (current.targetMode === 'origin') {
        setOriginCoords({ lat: roundedLat, lon: roundedLon });
        setOriginName(place);
        setTargetMode('dest');
      } else {
        setDestCoords({ lat: roundedLat, lon: roundedLon });
        setDestName(place);
      }
    });

    mapInstanceRef.current = map;

    requestAnimationFrame(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Color segment by risk level
  const getRiskColor = (score) => {
    if (score === null || score === undefined) return '#64748b'; // Slate / grey: no forecast
    if (score <= 34) return '#10b981'; // Emerald SAFE
    if (score <= 64) return '#f59e0b'; // Amber CAUTION
    if (score <= 79) return '#f97316'; // Orange UNSAFE
    return '#ef4444'; // Rose DANGEROUS
  };

  const getRiskLevelName = (score, level) => {
    if (level && level !== 'undefined') return level;
    if (score === null || score === undefined) return t('route.legendNoForecast');
    if (score <= 34) return 'SAFE';
    if (score <= 64) return 'CAUTION';
    if (score <= 79) return 'UNSAFE';
    return 'DANGEROUS';
  };

  // Render Route Polyline & Markers on Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (routeLayerRef.current) {
      mapInstanceRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    const group = L.layerGroup().addTo(mapInstanceRef.current);
    routeLayerRef.current = group;

    // Plot Origin Marker
    if (originCoords && typeof originCoords.lat === 'number') {
      const originIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background-color:#06b6d4;width:14px;height:14px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 8px #06b6d4;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([originCoords.lat, originCoords.lon], { icon: originIcon })
        .bindPopup(`<b>${t('route.originPopup')}:</b> ${originName || t('route.departureWaypoint')}<br><span style="font-family:monospace;font-size:11px;">${originCoords.lat}°N, ${originCoords.lon}°E</span>`)
        .addTo(group);
    }

    // Plot Destination Marker
    if (destCoords && typeof destCoords.lat === 'number') {
      const destIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background-color:#a855f7;width:14px;height:14px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 8px #a855f7;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([destCoords.lat, destCoords.lon], { icon: destIcon })
        .bindPopup(`<b>${t('route.destPopup')}:</b> ${destName || t('route.targetWaypoint')}<br><span style="font-family:monospace;font-size:11px;">${destCoords.lat}°N, ${destCoords.lon}°E</span>`)
        .addTo(group);
    }

    // Render Waypoints and Segments if routeResult exists
    if (routeResult && Array.isArray(routeResult.waypoints) && routeResult.waypoints.length > 1) {
      const wps = routeResult.waypoints;

      // Draw multi-colored segment polylines
      for (let i = 0; i < wps.length - 1; i++) {
        const p1 = wps[i];
        const p2 = wps[i + 1];
        const color = getRiskColor(p2.risk_score ?? p1.risk_score);

        L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], {
          color,
          weight: 4.5,
          opacity: 0.9,
        }).addTo(group);
      }

      // Draw waypoint dot markers
      wps.forEach((wp) => {
        const color = getRiskColor(wp.risk_score);
        const wpMarker = L.circleMarker([wp.lat, wp.lon], {
          radius: 4,
          fillColor: color,
          color: '#ffffff',
          weight: 1.5,
          fillOpacity: 1,
        });

        const scoreText = wp.risk_score !== null && wp.risk_score !== undefined
          ? `${Math.round(wp.risk_score)}/100 (${wp.risk_level || t('results.evaluated')})`
          : t('route.noForecastData');

        wpMarker.bindPopup(`
          <div style="font-family:sans-serif;font-size:12px;color:#0f172a;">
            <b>${t('route.waypointLabel')} ${wp.seq}</b> (${wp.point_id || 'WP'})<br/>
            <span>Coords: ${wp.lat.toFixed(3)}°N, ${wp.lon.toFixed(3)}°E</span><br/>
            <span>${t('results.totalDistance')}: ${wp.cumulative_distance_km ? `${wp.cumulative_distance_km.toFixed(1)} km` : '0 km'}</span><br/>
            <b>${t('hero.riskScore')}:</b> ${scoreText}
          </div>
        `);
        wpMarker.addTo(group);
      });

      // Fit map bounds to polyline
      const latlngs = wps.map((wp) => [wp.lat, wp.lon]);
      mapInstanceRef.current.fitBounds(latlngs, { padding: [40, 40] });
    }
  }, [originCoords, destCoords, originName, destName, routeResult, t]);

  const handleCalculateRoute = async (e) => {
    if (e) e.preventDefault();

    if (!originCoords && !originName) {
      setErrorMessage(t('route.errorOrigin'));
      return;
    }
    if (!destCoords && !destName) {
      setErrorMessage(t('route.errorDest'));
      return;
    }
    if (!vesselType) {
      setErrorMessage(t('route.errorVessel'));
      return;
    }

    setIsCalculating(true);
    setErrorMessage(null);
    setRouteResult(null);
    setStatusMessage(t('route.statusSubmitting'));

    try {
      const payload = {
        origin: {
          place_name: originName || undefined,
          coordinate: originCoords || undefined,
        },
        destination: {
          place_name: destName || undefined,
          coordinate: destCoords || undefined,
        },
        vessel_type: vesselType,
      };

      if (departureTime) {
        payload.departure_time = new Date(departureTime).toISOString();
      }

      if (selectedLang && selectedLang !== 'auto') {
        payload.language_override = selectedLang;
      }

      const res = await orcaApi.calculateRoute(payload);
      const routeId = res.route_id;

      if (!routeId) {
        throw new Error(t('route.errorNoId'));
      }

      setStatusMessage(t('route.statusSolving'));

      // Poll until completed | no_safe_route | failed
      let attempts = 0;
      let finished = false;
      while (!finished && attempts < 35) {
        attempts++;
        await new Promise((r) => setTimeout(r, 1500));
        const check = await orcaApi.getRoute(routeId);

        if (check.status === 'completed') {
          finished = true;
          setRouteResult(check);

          // Save to local history
          addEntry({
            analysis_id: routeId,
            kind: 'route',
            title: `${originName || 'Origin'} to ${destName || 'Destination'} Route`,
            place: originName || 'Coastal Sector',
            created_at: new Date().toISOString(),
          });
        } else if (check.status === 'no_safe_route') {
          finished = true;
          setRouteResult(check);
        } else if (check.status === 'failed') {
          finished = true;
          throw new Error(check.error?.message || t('route.errorFailed'));
        }
      }

      if (!finished) {
        throw new Error(t('route.errorTimeout'));
      }

    } catch (err) {
      console.error('Route calculation error:', err);
      setErrorMessage(err.message || t('route.errorGeneral'));
    } finally {
      setIsCalculating(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-4 sm:py-6">
      
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <Navigation className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {t('route.title')}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {t('route.subtitle')}
          </p>
        </div>

        <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-3 py-1.5 rounded-xl border border-cyan-800 w-fit">
          {t('route.badge')}
        </span>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 flex items-start space-x-3 text-xs sm:text-sm shadow-lg">
          <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-bold">{t('route.routingError')}: </span>
            <span className="whitespace-pre-line">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-semibold">
            {t('route.dismiss')}
          </button>
        </div>
      )}

      {/* Main Grid: Form Controls (Left) + Leaflet Chart (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Mission Setup */}
        <div className="lg:col-span-5 space-y-5">
          <form onSubmit={handleCalculateRoute} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            
            {/* Origin */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('route.originLabel')}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setTargetMode('origin')}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                    targetMode === 'origin' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {t('route.clickMapToSet')}
                </button>
              </label>
              <input
                type="text"
                value={originName}
                onChange={(e) => setOriginName(e.target.value)}
                placeholder={t('route.originPlaceholder')}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
              />
              {originCoords && (
                <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>{t('route.pin')}: {originCoords.lat}°N, {originCoords.lon}°E</span>
                </div>
              )}
            </div>

            {/* Destination */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-purple-400" />
                  <span>{t('route.destLabel')}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setTargetMode('dest')}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                    targetMode === 'dest' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {t('route.clickMapToSet')}
                </button>
              </label>
              <input
                type="text"
                value={destName}
                onChange={(e) => setDestName(e.target.value)}
                placeholder={t('route.destPlaceholder')}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
              />
              {destCoords && (
                <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>{t('route.pin')}: {destCoords.lat}°N, {destCoords.lon}°E</span>
                </div>
              )}
            </div>

            {/* Vessel Type Selection (REQUIRED) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Ship className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('route.vesselClass')} <span className="text-rose-400">*</span></span>
              </label>
              <select
                value={vesselType}
                onChange={(e) => setVesselType(e.target.value)}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer ${
                  !vesselType ? 'border-amber-700/80 bg-amber-950/20' : 'border-slate-700'
                }`}
              >
                <option value="">{t('route.selectVesselRequired')}</option>
                {VESSEL_TYPES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {t(`vessels.${v.id}`, { defaultValue: v.label })}
                  </option>
                ))}
              </select>
            </div>

            {/* Departure Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('route.departureTimeLabel')}</span>
              </label>
              <input
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isCalculating}
              className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('route.computingRoute')}</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  <span>{t('route.calculateRoute')}</span>
                </>
              )}
            </button>
          </form>

          {/* Map Color Legend */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-xs space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('route.legendTitle')}</div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center space-x-1.5 text-emerald-400">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span>{t('route.legendSafe')}</span>
              </span>
              <span className="flex items-center space-x-1.5 text-amber-400">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span>{t('route.legendCaution')}</span>
              </span>
              <span className="flex items-center space-x-1.5 text-orange-400">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                <span>{t('route.legendUnsafe')}</span>
              </span>
              <span className="flex items-center space-x-1.5 text-rose-400">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                <span>{t('route.legendDangerous')}</span>
              </span>
              <span className="flex items-center space-x-1.5 text-slate-400">
                <span className="w-3 h-3 rounded-full bg-slate-500"></span>
                <span>{t('route.legendNoForecast')}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Chart & Results */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Leaflet Nautical Map Container */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl relative">
            <div className="bg-slate-950/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center space-x-1.5">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>{t('route.chartTitle')}</span>
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {t('route.modeSetting')} <b className="text-cyan-400 uppercase">{targetMode}</b>
              </span>
            </div>
            
            <div
              ref={mapContainerRef}
              className="w-full bg-slate-950"
              style={{ height: '360px' }}
            />
          </div>

          {/* Route Results Presentation */}
          {routeResult && (
            <div className="space-y-4">
              
              {/* If no_safe_route */}
              {routeResult.status === 'no_safe_route' ? (
                <div className="p-6 rounded-3xl bg-rose-950/40 border border-rose-800 text-rose-200 space-y-3">
                  <div className="flex items-center space-x-2 text-rose-400 font-black text-base">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{t('route.noSafeRouteFound')}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-rose-300">
                    {t('route.noSafeRouteDesc')}
                  </p>
                  {Array.isArray(routeResult.blocking_reasons) && routeResult.blocking_reasons.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-rose-900/60">
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-300">{t('route.blockingConditions')}:</span>
                      {routeResult.blocking_reasons.map((reason, i) => (
                        <div key={i} className="text-xs flex items-start space-x-1.5">
                          <span className="text-rose-400">•</span>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Completed Route Summary */
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">{t('route.passagePlanTitle')}</h3>
                      <p className="text-xs text-slate-400 font-mono">{t('route.routeId')}: {routeResult.route_id}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase border ${
                      routeResult.max_risk_level === 'SAFE' 
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : routeResult.max_risk_level === 'CAUTION'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-rose-950 text-rose-300 border-rose-800'
                    }`}>
                      {t('route.maxCorridor')}: {routeResult.max_risk_level || t('results.evaluated')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">{t('results.totalDistance')}</span>
                      <span className="text-lg font-black text-white">
                        {routeResult.total_distance_km ? `${routeResult.total_distance_km.toFixed(1)} km` : '—'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">{t('results.estPassageTime')}</span>
                      <span className="text-lg font-black text-cyan-400">
                        {routeResult.estimated_duration_hours ? `${routeResult.estimated_duration_hours.toFixed(1)} hrs` : '—'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">{t('route.maxRiskScore')}</span>
                      <span className="text-lg font-black text-white">
                        {routeResult.max_risk_score !== null && routeResult.max_risk_score !== undefined 
                          ? `${Math.round(routeResult.max_risk_score)}/100` 
                          : t('pointDetail.unavailable')}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">{t('results.waypoints')}</span>
                      <span className="text-lg font-black text-purple-400">
                        {routeResult.waypoints?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Waypoint Table */}
                  {Array.isArray(routeResult.waypoints) && routeResult.waypoints.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{t('route.waypointSchedule')}</span>
                      <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono">
                            <tr>
                              <th className="p-2">#</th>
                              <th className="p-2">{t('route.thCoordinates')}</th>
                              <th className="p-2">{t('route.thDistance')}</th>
                              <th className="p-2">{t('route.thRiskLevel')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                            {routeResult.waypoints.map((wp) => (
                              <tr key={wp.seq} className="hover:bg-slate-900/40">
                                <td className="p-2 text-cyan-400 font-bold">{wp.seq}</td>
                                <td className="p-2">{wp.lat.toFixed(3)}°N, {wp.lon.toFixed(3)}°E</td>
                                <td className="p-2">{wp.cumulative_distance_km ? `${wp.cumulative_distance_km.toFixed(1)} km` : '0 km'}</td>
                                <td className="p-2">
                                  <span style={{ color: getRiskColor(wp.risk_score) }} className="font-bold">
                                    {wp.risk_score !== null && wp.risk_score !== undefined ? `${Math.round(wp.risk_score)} (${getRiskLevelName(wp.risk_score, wp.risk_level)})` : t('route.legendNoForecast')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
