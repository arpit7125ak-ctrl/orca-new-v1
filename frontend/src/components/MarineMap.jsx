/**
 * ============================================================================
 * ORCA Marine Interactive Leaflet Map (src/components/MarineMap.jsx)
 * ============================================================================
 * Premium maritime GIS visualization component for maritime safety analysis.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { Compass, ShieldAlert, Layers, MapPin, Anchor, ChevronDown, Clock, Info } from 'lucide-react';
import { orcaApi } from '../api/client';

// ---------------------------------------------------------------------------
// DATA-DRIVEN RISK COLOR SYSTEM
// Maps risk severity to professional maritime GIS colors.
// ---------------------------------------------------------------------------
const RISK_PALETTE = {
  LOW:      { border: '#4ade80', fill: 'rgba(74, 222, 128, 0.20)', name: 'LOW RISK' },
  MODERATE: { border: '#facc15', fill: 'rgba(250, 204, 21, 0.25)', name: 'MODERATE' },
  HIGH:     { border: '#f97316', fill: 'rgba(249, 115, 22, 0.35)', name: 'HIGH RISK' },
  SEVERE:   { border: '#dc2626', fill: 'rgba(220, 38, 38, 0.45)',  name: 'SEVERE' },
  EXTREME:  { border: '#c026d3', fill: 'rgba(192, 38, 211, 0.55)', name: 'EXTREME' },
  LAND:     { border: '#64748b', fill: 'rgba(100, 116, 139, 0.15)',name: 'LAND (N/A)' },
  UNKNOWN:  { border: '#94a3b8', fill: 'rgba(148, 163, 184, 0.15)',name: 'UNKNOWN' },
};

// ---------------------------------------------------------------------------
// MULTI-LAYER DEFINITIONS
// ---------------------------------------------------------------------------
const LAYERS = {
  overall: {
    label: 'Overall Risk',
    getValue: (pt) => pt.risk?.final_score,
    format: (v) => v != null ? `${Math.round(v)} / 100` : 'N/A',
    getLevel: (v) => {
      if (v == null) return 'UNKNOWN';
      if (v < 35) return 'LOW';
      if (v < 60) return 'MODERATE';
      if (v < 80) return 'HIGH';
      if (v < 90) return 'SEVERE';
      return 'EXTREME';
    }
  },
  wave: {
    label: 'Wave Height',
    getValue: (pt) => pt.risk?.weather?.wave_height_m ?? pt.risk?.metocean?.wave_height_m,
    format: (v) => v != null ? `${v.toFixed(1)} m` : 'N/A',
    getLevel: (v) => {
      if (v == null) return 'UNKNOWN';
      if (v < 1.0) return 'LOW';
      if (v <= 2.0) return 'MODERATE';
      if (v <= 3.5) return 'HIGH';
      if (v <= 5.0) return 'SEVERE';
      return 'EXTREME';
    }
  },
  wind: {
    label: 'Wind Speed',
    getValue: (pt) => pt.risk?.weather?.wind_speed_ms,
    format: (v) => v != null ? `${Math.round(v * 1.94384)} kt` : 'N/A',
    getLevel: (v) => {
      if (v == null) return 'UNKNOWN';
      const kt = v * 1.94384;
      if (kt < 15) return 'LOW';
      if (kt <= 25) return 'MODERATE';
      if (kt <= 35) return 'HIGH';
      if (kt <= 50) return 'SEVERE';
      return 'EXTREME';
    }
  },
  visibility: {
    label: 'Visibility',
    getValue: (pt) => pt.risk?.weather?.visibility_km,
    format: (v) => v != null ? `${v.toFixed(1)} km` : 'N/A',
    getLevel: (v) => {
      if (v == null) return 'UNKNOWN';
      if (v > 10) return 'LOW';
      if (v >= 5) return 'MODERATE';
      if (v >= 2) return 'HIGH';
      if (v >= 1) return 'SEVERE';
      return 'EXTREME';
    }
  },
  cyclone: {
    label: 'Cyclone Risk',
    getValue: (pt) => {
       const w = pt.risk?.official_warnings || [];
       if (w.length === 0) return 0;
       const wt = w[0].zone_category || '';
       if (wt.toLowerCase().includes('cyclone') || wt.toLowerCase().includes('depression')) {
         if (w[0].constraint_type === 'hard_exclusion') return 4;
         return 3;
       }
       return 1;
    },
    format: (v) => {
       if (v === 4) return 'Severe Cyclone';
       if (v === 3) return 'Depression / Storm';
       if (v === 1) return 'Advisory Active';
       return 'Safe';
    },
    getLevel: (v) => {
      if (v === 4) return 'EXTREME';
      if (v === 3) return 'SEVERE';
      if (v === 1) return 'MODERATE';
      return 'LOW';
    }
  }
};

const TIME_STEPS = [
  { offset: -6, label: '-6h', type: 'PAST' },
  { offset: -3, label: '-3h', type: 'PAST' },
  { offset: 0,  label: 'NOW', type: 'NOW' },
  { offset: 3,  label: '+3h', type: 'FORECAST' },
  { offset: 6,  label: '+6h', type: 'FORECAST' },
  { offset: 12, label: '+12h', type: 'FORECAST' },
  { offset: 24, label: '+24h', type: 'FORECAST' }
];

const TILE_LAYERS = {
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri',
    maxZoom: 18,
  },
  hybrid: {
    label: 'Satellite + Labels',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri',
    maxZoom: 18,
    overlay: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  },
  street: {
    label: 'Street Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: 'OSM',
    maxZoom: 19,
  },
};

// Voronoi cell generator
function computeZonePolygons(points, validLat, validLon) {
  const seaPoints = points.filter((pt) => pt.land_sea !== 'land' && pt.point_status !== 'not_applicable');
  if (seaPoints.length < 2) return null;

  const lats = seaPoints.map((p) => Number(p.lat ?? validLat));
  const lons = seaPoints.map((p) => Number(p.lon ?? validLon));
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const latPad = Math.max((maxLat - minLat) * 0.40, 0.04);
  const lonPad = Math.max((maxLon - minLon) * 0.40, 0.04);

  const bMinLat = minLat - latPad, bMaxLat = maxLat + latPad;
  const bMinLon = minLon - lonPad, bMaxLon = maxLon + lonPad;
  const latStep = (bMaxLat - bMinLat) / 3, lonStep = (bMaxLon - bMinLon) / 3;

  const cells = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      cells.push({
        minLat: bMinLat + row * latStep, maxLat: bMinLat + (row + 1) * latStep,
        minLon: bMinLon + col * lonStep, maxLon: bMinLon + (col + 1) * lonStep,
        cLat: bMinLat + (row + 0.5) * latStep, cLon: bMinLon + (col + 0.5) * lonStep
      });
    }
  }

  return points.map((pt) => {
    if (pt.land_sea === 'land' || pt.point_status === 'not_applicable') return null;
    let best = cells[0], bestD = Infinity;
    const pLat = Number(pt.lat ?? validLat), pLon = Number(pt.lon ?? validLon);
    cells.forEach(c => {
      const d = Math.pow(pLat - c.cLat, 2) + Math.pow(pLon - c.cLon, 2);
      if (d < bestD) { bestD = d; best = c; }
    });
    return [
      [best.minLat, best.minLon], [best.maxLat, best.minLon],
      [best.maxLat, best.maxLon], [best.minLat, best.maxLon],
    ];
  });
}

export default function MarineMap({ analysis, selectedPoint, onSelectPoint }) {
  const { t } = useTranslation('ui');
  const plan = analysis?.plan || {};

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef(null);
  const polygonsRef = useRef({});
  const baseLayerRef = useRef(null);
  const labelLayerRef = useRef(null);

  const [activeBase, setActiveBase] = useState('satellite');
  const [activeRiskLayer, setActiveRiskLayer] = useState('overall');
  const [selectedTimeOffset, setSelectedTimeOffset] = useState(0); // 0 = NOW
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showRiskMenu, setShowRiskMenu] = useState(false);
  const [clickedZoneId, setClickedZoneId] = useState(null);
  const [gisLayers, setGisLayers] = useState([]);

  const validLat = plan.location?.validated?.lat != null ? Number(plan.location.validated.lat) : Number(plan.location?.original?.lat);
  const validLon = plan.location?.validated?.lon != null ? Number(plan.location.validated.lon) : Number(plan.location?.original?.lon);
  const hasValidCoords = Number.isFinite(validLat) && Number.isFinite(validLon);
  const pointsData = analysis?.points || [];

  // Enable CSS transitions on leaflet SVG paths globally
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .leaflet-interactive {
        transition: fill 0.5s ease-out, stroke 0.5s ease-out, fill-opacity 0.5s ease-out;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    async function loadLayers() {
      try {
        const data = await orcaApi.getMapLayers();
        if (data && Array.isArray(data.layers)) setGisLayers(data.layers);
      } catch (err) {}
    }
    loadLayers();
  }, []);

  // INIT MAP
  useEffect(() => {
    if (!mapContainerRef.current || !hasValidCoords) return;
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, { center: [validLat, validLon], zoom: 10, zoomControl: false });
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      
      const tDef = TILE_LAYERS.satellite;
      baseLayerRef.current = L.tileLayer(tDef.url, { maxZoom: tDef.maxZoom }).addTo(map);
      layersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      // Force size
      setTimeout(() => map.invalidateSize(), 200);
    }
  }, [hasValidCoords, validLat, validLon]);

  // BASEMAP SWITCHER
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
    if (labelLayerRef.current) map.removeLayer(labelLayerRef.current);

    const tDef = TILE_LAYERS[activeBase];
    baseLayerRef.current = L.tileLayer(tDef.url, { maxZoom: tDef.maxZoom }).addTo(map);
    baseLayerRef.current.bringToBack();
    
    if (activeBase === 'hybrid' && tDef.overlay) {
      labelLayerRef.current = L.tileLayer(tDef.overlay, { opacity: 0.9, maxZoom: 18 }).addTo(map);
    }
  }, [activeBase]);

  // RENDER RISK HEATMAP
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    // We don't clear the group every time! We update existing polygons to trigger CSS transitions.
    // However, if polygons don't exist yet, we create them.
    
    const polygons = computeZonePolygons(pointsData, validLat, validLon);
    
    pointsData.forEach((pt, idx) => {
      const pId = pt.point_id ?? `P${idx}`;
      const isLand = pt.land_sea === 'land' || pt.point_status === 'not_applicable';
      
      // Attempt to find forecast data if time offset != 0
      let activePtData = pt;
      let forecastUnavailable = false;
      if (selectedTimeOffset !== 0) {
        // Mock fallback check - if API actually provided forecasts we would use them
        if (pt.forecasts && Array.isArray(pt.forecasts)) {
          const f = pt.forecasts.find(f => f.hour_offset === selectedTimeOffset);
          if (f) activePtData = { ...pt, risk: f.risk };
          else forecastUnavailable = true;
        } else {
          forecastUnavailable = true; // no forecast array available
        }
      }

      // Compute visual state
      let riskLevel = 'UNKNOWN';
      if (isLand) riskLevel = 'LAND';
      else {
        const val = LAYERS[activeRiskLayer].getValue(activePtData);
        riskLevel = LAYERS[activeRiskLayer].getLevel(val);
      }
      
      const palette = RISK_PALETTE[riskLevel];
      const isClicked = clickedZoneId === pId;
      
      // Update or create polygon
      const coords = polygons ? polygons[idx] : null;
      if (coords && !isLand) {
        if (!polygonsRef.current[pId]) {
          // CREATE
          const poly = L.polygon(coords, {
            color: palette.border,
            weight: isClicked ? 4 : 2,
            opacity: isClicked ? 1.0 : 0.8,
            fillColor: palette.border, // fill uses border color but transparent
            fillOpacity: isClicked ? 0.4 : parseFloat(palette.fill.split(',')[3]), // hacky extraction or just use a mapping
            className: 'risk-zone-poly',
            interactive: true,
          }).addTo(group);
          
          poly.on('click', () => {
            setClickedZoneId(pId);
            if (onSelectPoint) onSelectPoint(pt);
          });
          poly.on('mouseover', () => {
            poly.setStyle({ weight: 4, opacity: 1.0 });
          });
          poly.on('mouseout', () => {
             // restore if not clicked
             if (polygonsRef.current[pId]?.isClicked) return;
             poly.setStyle({ weight: 2, opacity: 0.8 });
          });
          
          polygonsRef.current[pId] = { layer: poly, isClicked };
        } else {
          // UPDATE (animates via CSS)
          const poly = polygonsRef.current[pId].layer;
          polygonsRef.current[pId].isClicked = isClicked;
          poly.setStyle({
            color: palette.border,
            fillColor: palette.border,
            weight: isClicked ? 4 : 2,
            opacity: isClicked ? 1.0 : 0.8,
            fillOpacity: isClicked ? 0.45 : (riskLevel==='EXTREME'?0.5:riskLevel==='SEVERE'?0.4:riskLevel==='HIGH'?0.3:riskLevel==='MODERATE'?0.2:0.15),
          });
        }
        
        // Add subtle text label at polygon center
        const cLat = coords.reduce((sum, c) => sum + c[0], 0) / 4;
        const cLon = coords.reduce((sum, c) => sum + c[1], 0) / 4;
        const labelIcon = L.divIcon({
          className: '',
          html: `<div style="
            color: ${palette.border};
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            text-align: center;
            text-shadow: 0 0 6px rgba(0,0,0,1);
            pointer-events: none;
            line-height: 1.1;
          ">${riskLevel}<br/><span style="font-size:8px;opacity:0.8;">${LAYERS[activeRiskLayer].label}</span></div>`,
          iconAnchor: [30, 10]
        });
        
        // Ensure we update or create the label
        if (!polygonsRef.current[`${pId}_label`]) {
          const m = L.marker([cLat, cLon], { icon: labelIcon, interactive: false }).addTo(group);
          polygonsRef.current[`${pId}_label`] = m;
        } else {
          polygonsRef.current[`${pId}_label`].setIcon(labelIcon);
        }
      }
    });

    // ── Route Overlay (if available in analysis) ──
    const waypoints = analysis?.route?.waypoints || analysis?.plan?.route?.waypoints || analysis?.route || [];
    if (Array.isArray(waypoints) && waypoints.length > 1) {
      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        const p2 = waypoints[i + 1];
        if (!p1.lat || !p1.lon || !p2.lat || !p2.lon) continue;
        
        const riskScore = Math.max(p1.risk_score || 0, p2.risk_score || 0);
        let rLevel = 'LOW';
        if (riskScore > 80) rLevel = 'EXTREME';
        else if (riskScore > 60) rLevel = 'SEVERE';
        else if (riskScore > 40) rLevel = 'HIGH';
        else if (riskScore > 20) rLevel = 'MODERATE';
        
        const segColor = RISK_PALETTE[rLevel]?.border || '#4ade80';

        L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], {
          color: segColor,
          weight: 4,
          opacity: 0.9,
          dashArray: '4, 6'
        }).addTo(group);

        // Marker for route risk change or waypoints
        if (i === 0 || riskScore > (waypoints[i-1]?.risk_score || 0)) {
           L.circleMarker([p2.lat, p2.lon], {
              radius: 4, fillColor: segColor, color: '#fff', weight: 1, fillOpacity: 1
           }).addTo(group).bindPopup(`<div style="color:black;font-weight:bold;">Route Segment: ${rLevel}</div>`);
        }
      }
    }

    // ── Origin/request (Vessel) marker ──
    const userIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:14px;height:14px;border-radius:50%;
        background:#ffffff;
        border:3px solid #10b981;
        box-shadow:0 0 12px rgba(16,185,129,0.9);
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker([originalLat, originalLon], { icon: userIcon })
      .bindPopup(`<b>VESSEL / ORIGIN</b><br>${originalLat.toFixed(4)}°N, ${originalLon.toFixed(4)}°E`)
      .addTo(group);

  }, [analysis, activeRiskLayer, selectedTimeOffset, clickedZoneId, validLat, validLon]);

  if (!hasValidCoords) return <div className="h-[520px] rounded-2xl bg-[#0a0d0a] border border-[#243024] flex items-center justify-center"><Compass className="animate-spin text-[#d4850a]" /></div>;

  // Active clicked zone data
  const activeZone = pointsData.find(p => p.point_id === clickedZoneId) || pointsData[0];
  let forecastMissing = false;
  let activeZoneData = activeZone;
  if (selectedTimeOffset !== 0) {
    if (activeZone?.forecasts) {
       const f = activeZone.forecasts.find(f => f.hour_offset === selectedTimeOffset);
       if (f) activeZoneData = { ...activeZone, risk: f.risk };
       else forecastMissing = true;
    } else forecastMissing = true;
  }
  
  const v = LAYERS[activeRiskLayer].getValue(activeZoneData);
  const level = LAYERS[activeRiskLayer].getLevel(v);
  const color = RISK_PALETTE[level]?.border || '#94a3b8';

  return (
    <div className="relative w-full h-[600px] rounded-2xl overflow-hidden border border-[#243024] shadow-2xl bg-[#0a0d0a] flex flex-col font-sans">
      {/* MAP CANVAS */}
      <div ref={mapContainerRef} className="flex-1 w-full" />
      
      {/* TOP BAR OVERLAY */}
      <div className="absolute top-4 left-4 right-4 z-[400] flex justify-between pointer-events-none">
        
        {/* Layer Selector */}
        <div className="relative pointer-events-auto">
          <button onClick={() => setShowRiskMenu(!showRiskMenu)} className="flex items-center space-x-2 bg-[#111814]/90 backdrop-blur-md border border-[#243024] px-4 py-2 rounded-xl text-white shadow-lg hover:border-[#d4850a] transition">
            <Layers className="w-4 h-4 text-[#d4850a]" />
            <span className="font-bold text-sm tracking-wide">LAYER: {LAYERS[activeRiskLayer].label.toUpperCase()}</span>
            <ChevronDown className="w-4 h-4 text-white/50" />
          </button>
          
          {showRiskMenu && (
            <div className="absolute top-12 left-0 bg-[#111814]/95 backdrop-blur-xl border border-[#243024] rounded-xl shadow-2xl w-48 overflow-hidden">
              {Object.entries(LAYERS).map(([k, def]) => (
                <button key={k} onClick={() => { setActiveRiskLayer(k); setShowRiskMenu(false); }} className={`w-full text-left px-4 py-3 text-sm font-semibold transition ${activeRiskLayer === k ? 'bg-[#d4850a] text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                  {def.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Base Map Selector */}
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
        <div className="absolute top-20 right-4 z-[400] w-64 bg-[#111814]/95 backdrop-blur-xl border border-[#243024] rounded-2xl shadow-2xl p-4 flex flex-col text-white transform transition-all pointer-events-auto">
          <div className="flex justify-between items-start mb-3">
             <div>
               <div className="text-[10px] text-white/50 font-bold uppercase tracking-widest">{clickedZoneId} SECTOR</div>
               <div className="font-black text-lg" style={{ color }}>{RISK_PALETTE[level]?.name || 'UNKNOWN'}</div>
             </div>
             <button onClick={() => setClickedZoneId(null)} className="p-1 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition"><X className="w-4 h-4" /></button>
          </div>
          
          <div className="space-y-3">
             <div className="bg-black/30 rounded-lg p-2.5 border border-white/5 flex flex-col items-center justify-center">
               <span className="text-xs text-white/50 mb-1">{LAYERS[activeRiskLayer].label}</span>
               <span className="text-2xl font-bold font-mono" style={{ color }}>{LAYERS[activeRiskLayer].format(v)}</span>
             </div>
             
             {forecastMissing && (
                <div className="text-[10px] text-amber-500/80 bg-amber-500/10 p-2 rounded flex items-center">
                  <Info className="w-3 h-3 mr-1.5 flex-shrink-0" />
                  Forecast unavailable. Showing current valid data.
                </div>
             )}
             
             <div className="text-xs text-white/60 space-y-1.5 pt-2 border-t border-white/5">
                <div className="flex justify-between"><span>Wave:</span> <b className="text-white">{activeZoneData?.risk?.weather?.wave_height_m?.toFixed(1) || '-'} m</b></div>
                <div className="flex justify-between"><span>Wind:</span> <b className="text-white">{Math.round((activeZoneData?.risk?.weather?.wind_speed_ms||0)*1.94)} kt</b></div>
                <div className="flex justify-between"><span>Vis:</span> <b className="text-white">{activeZoneData?.risk?.weather?.visibility_km?.toFixed(1) || '-'} km</b></div>
             </div>
          </div>
        </div>
      )}

      {/* TIMELINE SLIDER (BOTTOM) */}
      <div className="absolute bottom-0 left-0 right-0 z-[400] bg-gradient-to-t from-[#0a0d0a] via-[#0a0d0a]/90 to-transparent pt-12 pb-4 px-6 pointer-events-auto">
         
         <div className="max-w-4xl mx-auto">
           {/* Legend integrated above timeline */}
           <div className="flex justify-between items-end mb-4">
              <div className="flex space-x-3 bg-[#111814]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#243024]">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest flex items-center mr-2">Risk Level</span>
                {['LOW','MODERATE','HIGH','SEVERE','EXTREME'].map(lvl => (
                  <div key={lvl} className="flex items-center space-x-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RISK_PALETTE[lvl].border, boxShadow: `0 0 8px ${RISK_PALETTE[lvl].border}` }} />
                    <span className="text-[10px] font-semibold text-white/80">{lvl}</span>
                  </div>
                ))}
              </div>
              
              <div className="text-right">
                 <div className="text-[10px] font-bold text-[#d4850a] uppercase tracking-widest">{selectedTimeOffset === 0 ? 'LIVE NOW' : 'FORECAST MODEL'}</div>
                 <div className="text-sm font-mono text-white/90">
                    {selectedTimeOffset === 0 ? 'Current Observation' : (selectedTimeOffset > 0 ? `+${selectedTimeOffset} Hours` : `${selectedTimeOffset} Hours`)}
                 </div>
              </div>
           </div>

           {/* Interactive Timeline Track */}
           <div className="relative h-12 flex items-center">
              <div className="absolute left-0 right-0 h-1 bg-[#243024] rounded-full" />
              
              {TIME_STEPS.map((step, i) => {
                 const isSelected = selectedTimeOffset === step.offset;
                 const isNow = step.offset === 0;
                 return (
                   <div key={step.offset} className="absolute flex flex-col items-center transform -translate-x-1/2" style={{ left: `${(i / (TIME_STEPS.length - 1)) * 100}%` }}>
                      <button 
                         onClick={() => setSelectedTimeOffset(step.offset)}
                         className={`w-4 h-4 rounded-full border-2 transition-all ${isSelected ? 'bg-[#d4850a] border-[#d4850a] scale-125 shadow-[0_0_12px_#d4850a]' : (isNow ? 'bg-[#22d3ee] border-[#22d3ee] shadow-[0_0_8px_#22d3ee]' : 'bg-[#111814] border-white/30 hover:border-white/70')}`}
                      />
                      <span className={`mt-2 text-[10px] font-bold ${isSelected ? 'text-[#d4850a]' : (isNow ? 'text-[#22d3ee]' : 'text-white/40')}`}>
                         {step.label}
                      </span>
                   </div>
                 );
              })}
           </div>
         </div>
      </div>

    </div>
  );
}
