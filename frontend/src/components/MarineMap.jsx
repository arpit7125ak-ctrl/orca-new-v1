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
  hybrid: { label: 'Hybrid Map', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', labelUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', maxZoom: 18 },
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
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState(null);
  const [visibleLayers, setVisibleLayers] = useState({ risk: true, gis: true, route: true, grid: true });

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

      L.control.scale({ nautical: true, imperial: false, metric: true, position: 'bottomright' }).addTo(map);
      map.on('mousemove', (e) => setCursorCoords(e.latlng));

      const tDef = TILE_LAYERS.satellite;
      baseLayerRef.current = L.tileLayer(tDef.url, { maxZoom: tDef.maxZoom }).addTo(map);
      
      gisGroupRef.current = L.layerGroup().addTo(map);
      dataGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    }
  }, [hasValidCoords, validLat, validLon]);

    const hybridLabelRef = useRef(null);

    // BASEMAP SWITCHER
    useEffect(() => {
      const map = mapInstanceRef.current;
      if (!map) return;
      if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
      if (hybridLabelRef.current) map.removeLayer(hybridLabelRef.current);
      
      const tDef = TILE_LAYERS[activeBase];
      baseLayerRef.current = L.tileLayer(tDef.url, { maxZoom: tDef.maxZoom }).addTo(map);
      baseLayerRef.current.bringToBack();
      
      if (tDef.labelUrl) {
         hybridLabelRef.current = L.tileLayer(tDef.labelUrl, { maxZoom: tDef.maxZoom, pane: 'gisPane' }).addTo(map);
      }
    }, [activeBase]);

    // PAN TO SELECTED POINT
    useEffect(() => {
      if (selectedPoint?.lat && selectedPoint?.lon && mapInstanceRef.current) {
         mapInstanceRef.current.flyTo([selectedPoint.lat, selectedPoint.lon], 12, { duration: 1.5 });
         setClickedZoneId(selectedPoint.point_id);
      }
    }, [selectedPoint]);

  // RENDER GIS NAUTICAL ZONES (STATIC - NEVER MOVES)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = gisGroupRef.current;
    if (!map || !group || !hasValidCoords) return;
    group.clearLayers();
    if (!visibleLayers.gis) return;

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
      if (visibleLayers.risk) map.addLayer(heatmapLayerRef.current);
    } else {
      heatmapLayerRef.current.updatePoints(hmPoints);
      if (visibleLayers.risk && !map.hasLayer(heatmapLayerRef.current)) map.addLayer(heatmapLayerRef.current);
      if (!visibleLayers.risk && map.hasLayer(heatmapLayerRef.current)) map.removeLayer(heatmapLayerRef.current);
    }

    group.clearLayers();

    // 3. Draw Grid Sampling Points
    hmPoints.forEach(p => {
      if (!visibleLayers.grid) return;
      const isClicked = clickedZoneId === p.id;
      const palette = getTierColor(p.value);
      const roundedScore = Math.round(p.value);
      const iconHtml = `<div class="flex items-center space-x-1" style="transform: translate(-5px, -5px);">
         <div style="width: 12px; height: 12px; border-radius: 50%; background: ${palette.border}; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.5);"></div>
         <div style="background: rgba(0,0,0,0.75); color: #fff; padding: 2px 4px; border-radius: 4px; font-size: 9px; font-weight: bold; border: 1px solid rgba(255,255,255,0.2); white-space: nowrap;">${p.id} • ${roundedScore}</div>
      </div>`;
      
      const m = L.marker([p.lat, p.lon], {
        pane: 'routePane', icon: L.divIcon({ className: '', html: iconHtml, iconAnchor: [0, 0] })
      }).addTo(group);
      
      m.on('click', () => {
        setClickedZoneId(p.id);
        if (onSelectPoint) onSelectPoint(p.orig);
      });
    });

    // 4. Draw Segmented Risk-Colored Route Overlay
    const waypoints = analysis?.route?.waypoints || analysis?.plan?.route?.waypoints || analysis?.route || [];
    if (visibleLayers.route && Array.isArray(waypoints) && waypoints.length > 1) {
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
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#ffffff;border:3px solid #10b981;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`,
        iconAnchor: [7, 7]
      })
    }).addTo(group).bindPopup(`<b>VESSEL / ORIGIN</b>`);

  }, [analysis, activeRiskLayer, selectedTimeOffset, clickedZoneId, validLat, validLon, visibleLayers]);

  if (!hasValidCoords) return <div className="h-[520px] rounded-lg bg-[#0a0d0a] border border-[#243024] flex items-center justify-center"><Compass className="animate-spin text-[#d4850a]" /></div>;

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
    <div className={`orca-map-container relative w-full overflow-hidden bg-[#0a0d0a] flex flex-col font-sans border border-[var(--border-base)] rounded-xl shadow-sm \${isMapFullscreen ? 'fixed inset-0 z-[9999] h-screen' : 'h-[700px]'}`}>
      
      {/* MAP CANVAS */}
      <div ref={mapContainerRef} className="flex-1 w-full bg-[#0a0d0a] z-[1]" />
      
      {/* TOP HEADER */}
      <div className="absolute top-0 left-0 right-0 z-[500] pointer-events-none flex justify-between items-start p-4">
         <div className="flex items-center space-x-3 pointer-events-auto bg-[#111814]/95 backdrop-blur-md px-4 py-2 rounded-lg border border-[var(--border-base)] shadow-sm">
            <span className="font-bold text-xs uppercase tracking-widest text-white">MARITIME RISK MAP</span>
            <div className="h-3 w-[1px] bg-white/20" />
            <div className="flex items-center text-[9px] text-[#22d3ee] font-bold uppercase tracking-wider">
               <span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee] mr-1.5 animate-pulse" />
               Live Data
            </div>
         </div>

         <div className="flex items-center space-x-2 pointer-events-auto">
            <button onClick={() => { if (mapInstanceRef.current) mapInstanceRef.current.setView([validLat, validLon], 9); }} className="bg-[#111814]/95 backdrop-blur-md px-3 py-2 rounded-lg border border-[var(--border-base)] shadow-sm text-xs font-bold text-white/70 hover:text-white transition cursor-pointer">
               Recenter
            </button>
            <button onClick={() => setIsMapFullscreen(!isMapFullscreen)} className="bg-[#111814]/95 backdrop-blur-md px-3 py-2 rounded-lg border border-[var(--border-base)] shadow-sm text-xs font-bold text-white/70 hover:text-white transition cursor-pointer">
               {isMapFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
         </div>
      </div>

      {/* RIGHT CONTROLS PANEL */}
      <div className="absolute top-16 right-4 z-[500] pointer-events-none flex flex-col items-end space-y-2">
         
         {/* Map Style Selector */}
         <div className="bg-[#111814]/95 backdrop-blur-md border border-[var(--border-base)] rounded-lg shadow-sm p-1.5 pointer-events-auto flex space-x-1">
            {Object.keys(TILE_LAYERS).map(k => (
               <button key={k} onClick={() => setActiveBase(k)} className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition cursor-pointer \${activeBase === k ? 'bg-[#243024] text-white' : 'text-white/50 hover:text-white'}`}>
                  {TILE_LAYERS[k].label.split(' ')[0]}
               </button>
            ))}
         </div>

         {/* Layer Controls */}
         <div className="bg-[#111814]/95 backdrop-blur-md border border-[var(--border-base)] rounded-lg shadow-sm p-3 pointer-events-auto w-48 mt-2">
            <div className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-3">MAP LAYERS</div>
            <div className="space-y-2.5">
               {Object.entries({ risk: 'Risk Layers', gis: 'GIS Zones', route: 'Route', grid: 'Grid Points' }).map(([key, label]) => (
                  <label key={key} className="flex items-center space-x-2 cursor-pointer group">
                     <input type="checkbox" checked={visibleLayers[key]} onChange={() => setVisibleLayers(prev => ({...prev, [key]: !prev[key]}))} className="appearance-none w-3.5 h-3.5 border border-[var(--border-base)] rounded bg-[#111814] checked:bg-[#d4850a] checked:border-[#d4850a] transition cursor-pointer" />
                     <span className={`text-xs font-medium transition \${visibleLayers[key] ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>{label}</span>
                  </label>
               ))}
            </div>
         </div>
      </div>

      {/* BOTTOM OVERLAYS */}
      <div className="absolute bottom-4 left-4 right-4 z-[500] flex justify-between items-end pointer-events-none">
         
         {/* Legends */}
         <div className="flex space-x-3 pointer-events-auto">
            {/* GIS Legend */}
            <div className="flex flex-col bg-[#111814]/95 backdrop-blur-md px-4 py-2 rounded-lg border border-[var(--border-base)] shadow-sm">
              <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1.5">GIS ZONES</span>
              <div className="flex space-x-4">
                {[{c: '#22B8CF', l: '12 NM'}, {c: '#6C63FF', l: '24 NM'}, {c: '#2DD4BF', l: '50 NM'}, {c: '#D4A72C', l: '100 NM'}].map(z => (
                  <div key={z.l} className="flex items-center space-x-1.5"><div className="w-4 h-0 border-t-2 border-dashed" style={{ borderColor: z.c }} /><span className="text-[9px] font-bold text-white/70">{z.l}</span></div>
                ))}
              </div>
            </div>
            
            {/* Risk Legend */}
            <div className="flex flex-col bg-[#111814]/95 backdrop-blur-md px-4 py-2 rounded-lg border border-[var(--border-base)] shadow-sm">
              <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1.5">RISK</span>
              <div className="flex space-x-3">
                {Object.values(RISK_PALETTE).map(p => (
                  <div key={p.name} className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.border }} /><span className="text-[9px] font-bold text-white/80 uppercase">{p.name}</span></div>
                ))}
              </div>
            </div>
         </div>

         {/* Right Bottom: Coords & Timeline */}
         <div className="flex flex-col items-end space-y-3 pointer-events-auto">
            {/* Coordinates */}
            {cursorCoords && (
               <div className="bg-[#111814]/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[var(--border-base)] shadow-sm font-mono text-[10px] text-white/70">
                  {Math.abs(cursorCoords.lat).toFixed(4)}° {cursorCoords.lat >= 0 ? 'N' : 'S'} &nbsp;|&nbsp; {Math.abs(cursorCoords.lng).toFixed(4)}° {cursorCoords.lng >= 0 ? 'E' : 'W'}
               </div>
            )}
            
            {/* Timeline */}
            <div className="bg-[#111814]/95 backdrop-blur-md border border-[var(--border-base)] rounded-lg py-4 px-6 shadow-sm w-80">
               <div className="flex justify-between items-center mb-5">
                  <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">TIME FORECAST</span>
                  <span className="text-[9px] font-bold text-[#d4850a]">{selectedTimeOffset === 0 ? 'NOW' : `\${selectedTimeOffset > 0 ? '+' : ''}\${selectedTimeOffset}h`}</span>
               </div>
               <div className="relative h-1 flex items-center w-full">
                  <div className="absolute left-0 right-0 h-0.5 bg-[var(--border-base)]" />
                  {TIME_STEPS.map((step, i) => {
                     const isSelected = selectedTimeOffset === step.offset;
                     const isNow = step.offset === 0;
                     return (
                       <div key={step.offset} className="absolute flex flex-col items-center transform -translate-x-1/2" style={{ left: `\${(i / (TIME_STEPS.length - 1)) * 100}%` }}>
                          <button onClick={() => setSelectedTimeOffset(step.offset)} className={`w-2.5 h-2.5 rounded-full border transition-all cursor-pointer \${isSelected ? 'bg-[#d4850a] border-[#d4850a] scale-125' : (isNow ? 'bg-[#22d3ee] border-[#22d3ee] scale-110' : 'bg-[#111814] border-white/30 hover:border-white/70')}`} />
                          <span className={`absolute top-3 text-[8px] font-bold tracking-wider \${isSelected ? 'text-[#d4850a]' : (isNow ? 'text-[#22d3ee]' : 'text-white/40')}`}>{step.label}</span>
                       </div>
                     );
                  })}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
