import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Compass, ShieldAlert, Layers, MapPin, Anchor } from 'lucide-react';
import { orcaApi } from '../api/client';

export default function MarineMap({ analysis, selectedPoint, onSelectPoint }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const layersGroupRef = useRef(null);
  const [showGeofence, setShowGeofence] = useState(true);
  const [showPorts, setShowPorts] = useState(false);
  const [gisLayers, setGisLayers] = useState([]);

  const plan = analysis?.plan || {};
  const validLat = Number(plan.location?.validated?.lat ?? plan.location?.original?.lat ?? 9.94);
  const validLon = Number(plan.location?.validated?.lon ?? plan.location?.original?.lon ?? 76.16);
  const originalLat = Number(plan.location?.original?.lat ?? validLat);
  const originalLon = Number(plan.location?.original?.lon ?? validLon);
  const isSnapped = plan.location?.validated?.snapped;

  // Load backend GIS layers for boundary rendering
  useEffect(() => {
    async function loadLayers() {
      try {
        const data = await orcaApi.getMapLayers();
        if (data && Array.isArray(data.layers)) {
          setGisLayers(data.layers);
        }
      } catch (err) {
        console.warn('GIS layers load:', err);
      }
    }
    loadLayers();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [validLat, validLon],
        zoom: 10,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenStreetMap standard tiles (Zero API key required, 100% free & watermark-free)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const layersGroup = L.layerGroup().addTo(map);
      const markersGroup = L.layerGroup().addTo(map);
      layersGroupRef.current = layersGroup;
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Render Markers and Grid Points from REAL analysis data
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Draw Requested Point
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `<div style="background-color:#38bdf8;width:14px;height:14px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 10px #38bdf8;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    L.marker([originalLat, originalLon], { icon: userIcon })
      .bindPopup(`<b>Mission Origin Request</b><br>Lat: ${originalLat.toFixed(3)}°N, Lon: ${originalLon.toFixed(3)}°E`)
      .addTo(group);

    // 2. If snapped offshore, draw snap line & reference
    if (isSnapped) {
      const snapLine = L.polyline(
        [
          [originalLat, originalLon],
          [validLat, validLon],
        ],
        {
          color: '#f59e0b',
          weight: 2.5,
          dashArray: '5, 8',
          opacity: 0.9,
        }
      ).addTo(group);

      snapLine.bindPopup(`<b>Shoreline Boundary Snapped</b><br>${plan.location?.validated?.snap_distance_km || '6.7'} km offshore (${plan.location?.validated?.snap_reference || 'Fisheries zone'})`);
    }

    // 3. Draw REAL 9 Spatial Grid Points from analysis
    const pointsData = analysis?.points || [];

    pointsData.forEach((pt, index) => {
      const pLat = Number(pt.lat ?? validLat);
      const pLon = Number(pt.lon ?? validLon);
      const pRisk = pt.risk || {};
      const pScore = pRisk.final_score ?? 30;
      const pId = pt.point_id ?? `P${index}`;
      const pLevel = pRisk.risk_level || (pScore > 80 ? 'DANGEROUS' : pScore > 60 ? 'UNSAFE' : pScore > 30 ? 'CAUTION' : 'SAFE');
      const pFindings = pRisk.key_findings || [];
      const hasWarning = pRisk.official_warnings && pRisk.official_warnings.length > 0;
      const isPreferred = analysis?.decision?.preferred_point === pId;
      const isWorst = analysis?.decision?.worst_point === pId;

      // Color mapping
      let color = '#10b981'; // Green (Safe)
      if (pScore > 80 || pLevel === 'DANGEROUS') color = '#ef4444'; // Red
      else if (pScore > 60 || pLevel === 'UNSAFE') color = '#f97316'; // Orange
      else if (pScore > 30 || pLevel === 'CAUTION') color = '#eab308'; // Yellow

      const circle = L.circleMarker([pLat, pLon], {
        radius: index === 0 ? 13 : 10,
        fillColor: color,
        color: isPreferred ? '#38bdf8' : isWorst ? '#ef4444' : '#ffffff',
        weight: isPreferred || isWorst ? 3 : 2,
        opacity: 1,
        fillOpacity: 0.85,
      }).addTo(group);

      circle.bindPopup(`
        <div style="font-family:sans-serif; min-width: 190px; max-width: 250px; color: #f8fafc;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <strong style="color: #38bdf8; font-size: 13px;">Point ${pId} ${index === 0 ? '(Origin)' : ''}</strong>
            <span style="background:${color}; color:#000; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:4px;">${pLevel}</span>
          </div>
          <div style="font-size: 11px; margin-bottom: 3px;">
            <b>Risk Score:</b> <span style="color:${color};font-weight:bold;">${Math.round(pScore)}/100</span>
            ${isPreferred ? ' <span style="color:#38bdf8;font-weight:bold;">[Recommended]</span>' : ''}
            ${isWorst ? ' <span style="color:#ef4444;font-weight:bold;">[Worst Point]</span>' : ''}
          </div>
          <div style="font-size: 11px; margin-bottom: 3px; color:#94a3b8;">
            <b>GPS:</b> ${pLat.toFixed(3)}°N, ${pLon.toFixed(3)}°E
          </div>
          ${hasWarning ? `<div style="font-size:10px; color:#f87171; font-weight:bold; margin-bottom:4px;">⚠️ ${pRisk.official_warnings[0].issuing_authority} Alert (${pRisk.official_warnings[0].bulletin_id || 'Active'})</div>` : ''}
          ${pFindings.length > 0 ? `<div style="font-size: 11px; color:#cbd5e1; border-top: 1px solid #334155; padding-top: 4px; margin-top: 4px;">${pFindings[0]}</div>` : ''}
        </div>
      `);

      circle.on('click', () => {
        if (onSelectPoint) onSelectPoint(pt);
      });
    });

    // Fit map view
    if (validLat && validLon) {
      map.setView([validLat, validLon], 10);
    }
  }, [analysis]);

  // Render Real GIS Layers & 12nm Territorial Waters
  useEffect(() => {
    const group = layersGroupRef.current;
    if (!group) return;

    group.clearLayers();

    if (showGeofence) {
      // 12 NM Territorial Water buffer
      const territorialCircle = L.circle([validLat, validLon], {
        radius: 22224, // 12 Nautical Miles in meters
        color: '#0ea5e9',
        weight: 1.5,
        dashArray: '6, 6',
        fill: false,
        opacity: 0.75,
      }).addTo(group);

      territorialCircle.bindPopup('<b>12 NM Territorial Water Baseline</b><br>State Fisheries Maritime Limits');

      // Add real boundary polygons from GIS layers (both Polygon and MultiPolygon)
      gisLayers.forEach((layer) => {
        if (layer.geometry && (layer.geometry.type === 'Polygon' || layer.geometry.type === 'MultiPolygon')) {
          try {
            const isHard = layer.constraint_type === 'hard_exclusion';
            const isMonsoon = layer.constraint_type === 'conditional_permit';
            const color = isHard ? '#ef4444' : isMonsoon ? '#f59e0b' : '#0ea5e9';

            L.geoJSON(layer.geometry, {
              style: {
                color: color,
                weight: isHard ? 2 : 1.5,
                dashArray: isMonsoon ? '6, 6' : isHard ? '4, 4' : '2, 4',
                fillOpacity: isHard ? 0.08 : 0.04,
                fillColor: color,
              },
            })
              .bindPopup(`
                <div style="font-family:sans-serif; min-width: 190px; color:#f8fafc;">
                  <strong style="color: ${color}; font-size:12px;">${layer.layer_name}</strong>
                  <div style="font-size:11px; margin-top:3px; color:#cbd5e1;">
                    <b>Safety Directive:</b> <span style="text-transform:capitalize;">${layer.constraint_type ? layer.constraint_type.replace(/_/g, ' ') : 'Advisory'}</span>
                  </div>
                  <div style="font-size:10px; margin-top:3px; color:#94a3b8;">
                    Source: ${layer.source}
                  </div>
                </div>
              `)
              .addTo(group);
          } catch (e) {
            console.warn('Error adding layer geojson:', e);
          }
        }
      });
    }

    // Render Surveyed Ports & Emergency Storm Shelters
    if (showPorts) {
      gisLayers.forEach((layer) => {
        if (layer.layer_type === 'port' && layer.geometry && layer.geometry.type === 'Point') {
          const [lon, lat] = layer.geometry.coordinates;
          const isShelter = layer.properties?.shelter_suitable;
          const portType = layer.properties?.port_type || 'port';
          const stateName = layer.properties?.state || '';

          const portIcon = L.divIcon({
            className: 'custom-port-marker',
            html: `<div style="background-color:${isShelter ? '#10b981' : '#38bdf8'};width:10px;height:10px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 6px ${isShelter ? '#10b981' : '#38bdf8'};"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5],
          });

          L.marker([lat, lon], { icon: portIcon })
            .bindPopup(`
              <div style="font-family:sans-serif; min-width:180px; color:#f8fafc;">
                <strong style="color:#38bdf8; font-size:12px;">⚓ ${layer.layer_name}</strong>
                <div style="font-size:11px; margin-top:3px; color:#cbd5e1;">
                  <b>Category:</b> <span style="text-transform:capitalize;">${portType.replace(/_/g, ' ')}</span> (${stateName})
                </div>
                <div style="font-size:11px; margin-top:2px; font-weight:600; color:${isShelter ? '#34d399' : '#94a3b8'};">
                  ${isShelter ? '🛡️ Emergency Storm Shelter Available' : 'Landing / Transit Facility'}
                </div>
              </div>
            `)
            .addTo(group);
        }
      });
    }
  }, [showGeofence, showPorts, gisLayers, validLat, validLon]);

  const handleRecenter = () => {
    if (mapInstanceRef.current && validLat && validLon) {
      mapInstanceRef.current.setView([validLat, validLon], 10);
    }
  };

  return (
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Controls */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col space-y-2">
        <div className="bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/80 shadow-md text-xs">
          <div className="flex items-center space-x-2 font-bold text-white mb-1">
            <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
            <span>9-Point Spatial Grid Map</span>
          </div>
          <p className="text-[11px] text-slate-300">
            Center: <b className="text-cyan-400 font-mono">{validLat.toFixed(3)}°N, {validLon.toFixed(3)}°E</b>
          </p>
          {isSnapped && (
            <span className="text-[10px] text-amber-400 font-semibold block mt-0.5">
              ⚠️ Shoreline Snapped ({plan.location?.validated?.snap_distance_km || 6.7}km Offshore)
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setShowGeofence(!showGeofence)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md backdrop-blur-md border ${
              showGeofence
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-900/80 text-slate-400 border-slate-700'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{showGeofence ? '12 NM Boundary: ON' : 'Show 12 NM Boundary'}</span>
          </button>

          <button
            onClick={() => setShowPorts(!showPorts)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md backdrop-blur-md border ${
              showPorts
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-900/80 text-slate-400 border-slate-700'
            }`}
          >
            <Anchor className="w-3.5 h-3.5" />
            <span>{showPorts ? 'Harbors: ON' : 'Show Harbors'}</span>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-700/80 shadow-md text-[11px] text-slate-300 flex items-center space-x-3">
        <span className="font-bold text-slate-200">Risk Color Scale:</span>
        <div className="flex items-center space-x-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span>Safe (0-30)</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
          <span>Caution (31-60)</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
          <span>Unsafe (61-80)</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
          <span>Danger (&gt;80)</span>
        </div>
      </div>

      {/* Recenter Button */}
      <div className="absolute top-3 right-3 z-[400]">
        <button
          onClick={handleRecenter}
          className="p-2.5 rounded-xl bg-slate-900/95 backdrop-blur-md hover:bg-slate-800 text-white border border-slate-700 shadow-lg text-xs font-semibold flex items-center space-x-1.5"
          title="Recenter to Mission Origin"
        >
          <MapPin className="w-4 h-4 text-cyan-400" />
          <span>Recenter</span>
        </button>
      </div>
    </div>
  );
}
