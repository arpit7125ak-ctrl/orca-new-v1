/**
 * ============================================================================
 * ORCA Marine Interactive Leaflet Map (src/components/MarineMap.jsx)
 * ============================================================================
 * Premium maritime GIS visualization component for maritime safety analysis.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { Compass, ShieldAlert, Layers, MapPin, Anchor, ChevronDown, Clock, Info, X } from 'lucide-react';
import { orcaApi } from '../api/client';
import { RiskHeatmapLayer } from './RiskHeatmapLayer';

// ---------------------------------------------------------------------------
// DATA-DRIVEN RISK COLOR SYSTEM
// ---------------------------------------------------------------------------
const RISK_PALETTE = {
  LOW:      { border: '#2FAE72', fill: 'rgba(47, 174, 114, 0.15)', name: 'SAFE', tier: 0 },
  MODERATE: { border: '#D8B12D', fill: 'rgba(216, 177, 45, 0.20)', name: 'CAUTION', tier: 1 },
  HIGH:     { border: '#E59A24', fill: 'rgba(229, 154, 36, 0.25)', name: 'MODERATE', tier: 2 },
  SEVERE:   { border: '#E05A25', fill: 'rgba(224, 90, 37, 0.30)',  name: 'HIGH RISK', tier: 3 },
  DANGER:   { border: '#D63838', fill: 'rgba(214, 56, 56, 0.35)',  name: 'DANGER', tier: 4 },
  EXTREME:  { border: '#A91E5B', fill: 'rgba(169, 30, 91, 0.40)',  name: 'EXTREME', tier: 5 },
};

function getTierColor(val, overrideTier = null) {
  const tier = overrideTier !== null ? overrideTier : (
    val < 35 ? 0 :
    val < 50 ? 1 :
    val < 70 ? 2 :
    val < 85 ? 3 :
    val < 95 ? 4 : 5
  );
  if (tier === 0) return RISK_PALETTE.LOW;
  if (tier === 1) return RISK_PALETTE.MODERATE;
  if (tier === 2) return RISK_PALETTE.HIGH;
  if (tier === 3) return RISK_PALETTE.SEVERE;
  if (tier === 4) return RISK_PALETTE.DANGER;
  return RISK_PALETTE.EXTREME;
}

// ---------------------------------------------------------------------------
// MULTI-LAYER DEFINITIONS
// ---------------------------------------------------------------------------
const LAYERS = {
  overall: { label: 'Overall Risk', getValue: (pt) => pt.risk?.final_score ?? 0, format: (v) => v != null ? `${Math.round(v)} / 100` : 'N/A' },
  wave: { label: 'Wave Height', getValue: (pt) => Math.min(((pt.risk?.weather?.wave_height_m ?? pt.risk?.metocean?.wave_height_m ?? 0) / 5.0) * 100, 100), format: (v) => v != null ? `${((v/100)*5).toFixed(1)} m` : 'N/A' },
  wind: { label: 'Wind Speed', getValue: (pt) => Math.min((((pt.risk?.weather?.wind_speed_ms ?? 0) * 1.94384) / 50.0) * 100, 100), format: (v) => v != null ? `${Math.round(((v/100)*50))} kt` : 'N/A' },
  visibility: { label: 'Visibility', getValue: (pt) => Math.max(0, Math.min(((10 - (pt.risk?.weather?.visibility_km ?? 10)) / 10.0) * 100, 100)), format: (v) => v != null ? `${(10 - (v/100)*10).toFixed(1)} km` : 'N/A' },
  cyclone: { label: 'Cyclone Risk', getValue: (pt) => {
       const w = pt.risk?.official_warnings || [];
       if (w.length === 0) return 0;
       const wt = w[0].zone_category || '';
       if (wt.toLowerCase().includes('cyclone') || wt.toLowerCase().includes('depression')) return w[0].constraint_type === 'hard_exclusion' ? 100 : 80;
       return 40;
    }, format: (v) => v >= 100 ? 'Severe Cyclone' : v >= 80 ? 'Depression / Storm' : v >= 40 ? 'Advisory Active' : 'Safe' }
};

const TIME_STEPS = [
  { offset: -6, label: '-6h' }, { offset: -3, label: '-3h' }, { offset: 0, label: 'NOW' },
  { offset: 3, label: '+3h' }, { offset: 6, label: '+6h' }, { offset: 12, label: '+12h' }, { offset: 24, label: '+24h' }
];

const TILE_LAYERS = {
  satellite: { label: 'Satellite Base', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 18 },
  street: { label: 'Street Map', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 },
};

export default function MarineMap({ analysis, selectedPoint, onSelectPoint }) {
  const { t } = useTranslation('ui');
  const plan = analysis?.plan || {};

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const gisGroupRef = useRef(null);
  const dataGroupRef = useRef(null);
  const heatmapLayerRef = useRef(null);
  const baseLayerRef = useRef(null);

  const [activeBase, setActiveBase] = useState('satellite');
  const [activeRiskLayer, setActiveRiskLayer] = useState('overall');
  const [selectedTimeOffset, setSelectedTimeOffset] = useState(0); 
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showRiskMenu, setShowRiskMenu] = useState(false);
  const [clickedZoneId, setClickedZoneId] = useState(null);
  const [gisLayers, setGisLayers] = useState([]);

  const validLat = plan.location?.validated?.lat != null ? Number(plan.location.validated.lat) : Number(plan.location?.original?.lat);
  const validLon = plan.location?.validated?.lon != null ? Number(plan.location.validated.lon) : Number(plan.location?.original?.lon);
  const originalLat = Number(plan.location?.original?.lat ?? validLat);
  const originalLon = Number(plan.location?.original?.lon ?? validLon);
  const hasValidCoords = Number.isFinite(validLat) && Number.isFinite(validLon);
  const pointsData = analysis?.points || [];

  // Enable CSS styling for the container border
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .leaflet-interactive { transition: fill 0.5s ease-out, stroke 0.5s ease-out, fill-opacity 0.5s ease-out; }
      .orca-map-container { border: 2px solid #243024; box-shadow: 0 0 20px rgba(0,0,0,0.8); border-radius: 16px; }
      .grid-marker { transition: all 0.3s; }
      .grid-marker:hover { transform: scale(1.5); z-index: 1000 !important; }
      .nautical-label { color: #fff; font-size: 10px; font-weight: bold; background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); pointer-events: none; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Fetch existing GIS layers
  useEffect(() => {
    async function loadLayers() {
      try {
        const data = await orcaApi.getMapLayers();
        if (data && Array.isArray(data.layers)) setGisLayers(data.layers);
      } catch (err) { console.warn('GIS layers load:', err); }
    }
    loadLayers();
  }, []);

  // INIT MAP
  useEffect(() => {
    if (!mapContainerRef.current || !hasValidCoords) return;
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, { center: [validLat, validLon], zoom: 9, zoomControl: false });
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      
      // Setup Panes for explicit layer ordering
      map.createPane('gisPane');
      map.getPane('gisPane').style.zIndex = 410; // Above basemap, below risk
      map.createPane('riskPane');
      map.getPane('riskPane').style.zIndex = 420; // Heatmap Canvas
      map.createPane('routePane');
      map.getPane('routePane').style.zIndex = 430; // Routes and Markers

      const tDef = TILE_LAYERS.satellite;
      baseLayerRef.current = L.tileLayer(tDef.url, { maxZoom: tDef.maxZoom }).addTo(map);
      
      gisGroupRef.current = L.layerGroup().addTo(map);
      dataGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    }
  }, [hasValidCoords, validLat, validLon]);

  // BASEMAP SWITCHER
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
    const tDef = TILE_LAYERS[activeBase];
    baseLayerRef.current = L.tileLayer(tDef.url, { maxZoom: tDef.maxZoom }).addTo(map);
    baseLayerRef.current.bringToBack();
  }, [activeBase]);

  // RENDER GIS NAUTICAL ZONES (STATIC - NEVER MOVES)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = gisGroupRef.current;
    if (!map || !group || !hasValidCoords) return;
    group.clearLayers();

    // Official GIS Polygons and Lines
    gisLayers.forEach((layer) => {
      if (layer.geometry && (layer.geometry.type === 'Polygon' || layer.geometry.type === 'MultiPolygon' || layer.geometry.type === 'LineString' || layer.geometry.type === 'MultiLineString')) {
        
        const name = (layer.layer_name || '').toLowerCase();
        let color = '#0ea5e9';
        let labelStr = layer.layer_name || 'GIS BOUNDARY';
        
        if (name.includes('12 nm') || name.includes('12nm') || name.includes('territorial')) {
           color = '#22B8CF';
        } else if (name.includes('24 nm') || name.includes('24nm') || name.includes('contiguous')) {
           color = '#6C63FF';
        } else if (name.includes('50 nm') || name.includes('50nm')) {
           color = '#2DD4BF';
        } else if (name.includes('100 nm') || name.includes('100nm') || name.includes('eez') || name.includes('exclusive')) {
           color = '#D4A72C';
        } else if (layer.constraint_type === 'hard_exclusion') {
           color = '#ef4444';
        }
        
        const isPolygon = layer.geometry.type.includes('Polygon');

        L.geoJSON(layer.geometry, {
          pane: 'gisPane',
          style: { 
            color: color, 
            weight: 2, 
            dashArray: '6, 6', 
            fillOpacity: isPolygon ? 0.05 : 0, 
            fillColor: color 
          }
        }).addTo(group).bindPopup('<b style="color:' + color + '">' + labelStr + '</b>');
      }
    });
  }, [gisLayers, validLat, validLon, hasValidCoords]);

  // RENDER RISK HEATMAP & ROUTE (DYNAMIC)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = dataGroupRef.current;
    if (!map || !group) return;

    // 1. Prepare localized heatmap points (P0-P8)
    const hmPoints = [];
    pointsData.forEach((pt, idx) => {
      const pId = pt.point_id ?? `P${idx}`;
      if (pt.land_sea === 'land' || pt.point_status === 'not_applicable') return; // skip land for IDW
      
      let activePtData = pt;
      if (selectedTimeOffset !== 0 && pt.forecasts) {
        const f = pt.forecasts.find(f => f.hour_offset === selectedTimeOffset);
        if (f) activePtData = { ...pt, risk: f.risk };
      }
      hmPoints.push({ lat: pt.lat, lon: pt.lon, value: LAYERS[activeRiskLayer].getValue(activePtData), id: pId, orig: activePtData });
    });

    // 2. Update Canvas Heatmap (Blobs only)
    if (!heatmapLayerRef.current) {
      heatmapLayerRef.current = new RiskHeatmapLayer(hmPoints, {
        getColor: getTierColor,
        getTier: (v) => getTierColor(v).tier
      });
      heatmapLayerRef.current.getPane = () => map.getPane('riskPane'); // Attach to riskPane
      map.addLayer(heatmapLayerRef.current);
    } else {
      heatmapLayerRef.current.updatePoints(hmPoints);
    }

    group.clearLayers();

    // 3. Draw Grid Sampling Points
    hmPoints.forEach(p => {
      const isClicked = clickedZoneId === p.id;
      const palette = getTierColor(p.value);
      const iconHtml = `<div class="grid-marker" style="width: 10px; height: 10px; border-radius: 50%; background: #fff; border: 2px solid ${palette.border}; box-shadow: 0 0 10px ${palette.border}; opacity: ${isClicked ? 1 : 0.8};"></div>`;
      
      const m = L.marker([p.lat, p.lon], {
        pane: 'routePane', icon: L.divIcon({ className: '', html: iconHtml, iconAnchor: [5, 5] })
      }).addTo(group);
      
      m.on('click', () => {
        setClickedZoneId(p.id);
        if (onSelectPoint) onSelectPoint(p.orig);
      });
    });

    // 4. Draw Segmented Risk-Colored Route Overlay
    const waypoints = analysis?.route?.waypoints || analysis?.plan?.route?.waypoints || analysis?.route || [];
    if (Array.isArray(waypoints) && waypoints.length > 1) {
      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i], p2 = waypoints[i + 1];
        if (!p1.lat || !p1.lon || !p2.lat || !p2.lon) continue;
        
        const riskScore = Math.max(p1.risk_score || 0, p2.risk_score || 0);
        const segPalette = getTierColor(riskScore);

        L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], {
          color: segPalette.border, weight: 3, opacity: 1.0, dashArray: '4, 8', pane: 'routePane'
        }).addTo(group);

        if (i > 0) {
           L.circleMarker([p1.lat, p1.lon], {
              radius: 3, fillColor: segPalette.border, color: '#fff', weight: 1, fillOpacity: 1, pane: 'routePane'
           }).addTo(group);
        }
      }
      const dest = waypoints[waypoints.length - 1];
      L.circleMarker([dest.lat, dest.lon], {
        radius: 5, fillColor: '#000', color: '#fff', weight: 2, fillOpacity: 1, pane: 'routePane'
      }).addTo(group).bindPopup('Destination');
    }

    // 5. Origin / Vessel marker
    L.marker([originalLat, originalLon], { 
      pane: 'routePane',
      icon: L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#ffffff;border:3px solid #10b981;box-shadow:0 0 15px rgba(255,255,255,1);"></div>`,
        iconAnchor: [7, 7]
      })
    }).addTo(group).bindPopup(`<b>VESSEL / ORIGIN</b>`);

  }, [analysis, activeRiskLayer, selectedTimeOffset, clickedZoneId, validLat, validLon]);

  if (!hasValidCoords) return <div className="h-[520px] rounded-2xl bg-[#0a0d0a] border border-[#243024] flex items-center justify-center"><Compass className="animate-spin text-[#d4850a]" /></div>;

  const activeZone = pointsData.find(p => p.point_id === clickedZoneId) || pointsData[0];
  let forecastMissing = false, activeZoneData = activeZone;
  if (selectedTimeOffset !== 0) {
    if (activeZone?.forecasts) {
       const f = activeZone.forecasts.find(f => f.hour_offset === selectedTimeOffset);
       if (f) activeZoneData = { ...activeZone, risk: f.risk }; else forecastMissing = true;
    } else forecastMissing = true;
  }
  const v = LAYERS[activeRiskLayer].getValue(activeZoneData || {});
  const tierInfo = getTierColor(v);

  return (
    <div className="orca-map-container relative w-full h-[700px] overflow-hidden bg-[#0a0d0a] flex flex-col font-sans">
      
      {/* MAP CANVAS */}
      <div ref={mapContainerRef} className="flex-1 w-full bg-[#0a0d0a]" />
      
      {/* TOP CONTROLS */}
      <div className="absolute top-4 left-4 right-4 z-[500] flex justify-between pointer-events-none">
        <div className="relative pointer-events-auto">
          <button onClick={() => setShowRiskMenu(!showRiskMenu)} className="flex items-center space-x-2 bg-[#111814]/90 backdrop-blur-md border border-[#243024] px-4 py-2 rounded-xl text-white shadow-lg hover:border-white/40 transition">
            <Layers className="w-4 h-4 text-white" />
            <span className="font-bold text-sm tracking-wide">RISK LAYER: <span className="text-[#d4850a]">{LAYERS[activeRiskLayer].label}</span></span>
            <ChevronDown className="w-4 h-4 text-white/50" />
          </button>
          {showRiskMenu && (
            <div className="absolute top-12 left-0 bg-[#111814]/95 backdrop-blur-xl border border-[#243024] rounded-xl shadow-2xl w-56 overflow-hidden">
              {Object.entries(LAYERS).map(([k, def]) => (
                <button key={k} onClick={() => { setActiveRiskLayer(k); setShowRiskMenu(false); }} className={`w-full text-left px-4 py-3 text-sm font-semibold transition ${activeRiskLayer === k ? 'bg-[#d4850a] text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                  {def.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative pointer-events-auto">
          <button onClick={() => setShowLayerMenu(!showLayerMenu)} className="flex items-center space-x-2 bg-[#111814]/80 backdrop-blur-md border border-[#243024] px-3 py-1.5 rounded-lg text-white/80 text-xs hover:border-white/30 transition">
            <span>{TILE_LAYERS[activeBase].label}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showLayerMenu && (
            <div className="absolute top-9 right-0 bg-[#111814]/95 border border-[#243024] rounded-lg shadow-xl w-36 overflow-hidden">
              {Object.keys(TILE_LAYERS).map(k => (
                <button key={k} onClick={() => { setActiveBase(k); setShowLayerMenu(false); }} className={`w-full text-left px-3 py-2 text-xs transition ${activeBase === k ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`}>{TILE_LAYERS[k].label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE INFO PANEL */}
      {clickedZoneId && (
        <div className="absolute top-20 right-4 z-[500] w-64 bg-[#111814]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 flex flex-col text-white transform transition-all pointer-events-auto">
          <div className="flex justify-between items-start mb-3">
             <div>
               <div className="text-[10px] text-white/50 font-bold uppercase tracking-widest">{clickedZoneId} AREA</div>
               <div className="font-black text-lg" style={{ color: tierInfo.border }}>{tierInfo.name}</div>
             </div>
             <button onClick={() => setClickedZoneId(null)} className="p-1 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
             <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 flex flex-col items-center justify-center">
               <span className="text-xs text-white/50 mb-1">{LAYERS[activeRiskLayer].label}</span>
               <span className="text-2xl font-bold font-mono" style={{ color: tierInfo.border }}>{LAYERS[activeRiskLayer].format(v)}</span>
             </div>
             {forecastMissing && <div className="text-[10px] text-amber-500/80 bg-amber-500/10 p-2 rounded flex items-center"><Info className="w-3 h-3 mr-1.5 flex-shrink-0" />Forecast unavailable. Showing current data.</div>}
             <div className="text-xs text-white/60 space-y-1.5 pt-2 border-t border-white/5">
                <div className="flex justify-between"><span>Wave:</span> <b className="text-white">{activeZoneData?.risk?.weather?.wave_height_m?.toFixed(1) || '-'} m</b></div>
                <div className="flex justify-between"><span>Wind:</span> <b className="text-white">{Math.round((activeZoneData?.risk?.weather?.wind_speed_ms||0)*1.94)} kt</b></div>
                <div className="flex justify-between"><span>Vis:</span> <b className="text-white">{activeZoneData?.risk?.weather?.visibility_km?.toFixed(1) || '-'} km</b></div>
             </div>
          </div>
        </div>
      )}

      {/* TIMELINE & LEGENDS (BOTTOM) */}
      <div className="absolute bottom-0 left-0 right-0 z-[500] bg-gradient-to-t from-[#000000] via-[#0a0d0a]/90 to-transparent pt-12 pb-5 px-6 pointer-events-auto">
         <div className="max-w-5xl mx-auto">
           <div className="flex justify-between items-end mb-6">
              
              {/* Dual Legend Section */}
              <div className="flex space-x-6">
                {/* GIS Legend */}
                <div className="flex flex-col space-y-2 bg-[#0a0d0a]/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">GIS ZONES</span>
                  <div className="flex space-x-4">
                    {[{c: '#22B8CF', l: '12 NM'}, {c: '#6C63FF', l: '24 NM'}, {c: '#2DD4BF', l: '50 NM'}, {c: '#D4A72C', l: '100 NM'}].map(z => (
                      <div key={z.l} className="flex items-center space-x-1.5"><div className="w-3 h-0 border-t-2 border-dashed" style={{ borderColor: z.c }} /><span className="text-[9px] font-bold text-white/70">{z.l}</span></div>
                    ))}
                  </div>
                </div>
                
                {/* Risk Legend */}
                <div className="flex flex-col space-y-2 bg-[#0a0d0a]/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">RISK</span>
                  <div className="flex space-x-3">
                    {Object.values(RISK_PALETTE).map(p => (
                      <div key={p.name} className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.border }} /><span className="text-[9px] font-bold text-white/80 uppercase">{p.name}</span></div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                 <div className="text-[10px] font-bold text-[#d4850a] uppercase tracking-widest">{selectedTimeOffset === 0 ? 'LIVE CONDITIONS' : 'FORECAST MODEL'}</div>
                 <div className="text-sm font-mono font-bold text-white">
                    {selectedTimeOffset === 0 ? 'Current Observation' : (selectedTimeOffset > 0 ? `+${selectedTimeOffset} Hours` : `${selectedTimeOffset} Hours`)}
                 </div>
              </div>
           </div>

           {/* Interactive Timeline Track */}
           <div className="relative h-10 flex items-center">
              <div className="absolute left-0 right-0 h-1 bg-[#243024] rounded-full" />
              {TIME_STEPS.map((step, i) => {
                 const isSelected = selectedTimeOffset === step.offset;
                 const isNow = step.offset === 0;
                 return (
                   <div key={step.offset} className="absolute flex flex-col items-center transform -translate-x-1/2" style={{ left: `${(i / (TIME_STEPS.length - 1)) * 100}%` }}>
                      <button onClick={() => setSelectedTimeOffset(step.offset)} className={`w-4 h-4 rounded-full border-2 transition-all ${isSelected ? 'bg-[#d4850a] border-[#d4850a] scale-150 shadow-[0_0_15px_#d4850a]' : (isNow ? 'bg-[#22d3ee] border-[#22d3ee] shadow-[0_0_10px_#22d3ee] scale-125' : 'bg-[#111814] border-white/30 hover:border-white/70')}`} />
                      <span className={`mt-2 text-[10px] font-bold tracking-wider ${isSelected ? 'text-[#d4850a]' : (isNow ? 'text-[#22d3ee]' : 'text-white/40')}`}>{step.label}</span>
                   </div>
                 );
              })}
           </div>
         </div>
      </div>
    </div>
  );
}
