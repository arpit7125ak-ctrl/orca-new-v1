import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Compass, 
  Calendar, 
  Clock, 
  Ship, 
  Fish, 
  Navigation, 
  Send, 
  Mic, 
  MicOff, 
  Layers, 
  Sparkles, 
  LocateFixed, 
  CheckCircle2 
} from 'lucide-react';
import L from 'leaflet';
import { createSpeechRecognizer } from '../utils/speech';

export default function AnalysisInputPage({ onStartAnalyze, isLoading, defaultValues = {} }) {
  // Input fields matching Image 2 & Image 3
  const [locationName, setLocationName] = useState(defaultValues.place_name || 'Kochi Offshore');
  const [lat, setLat] = useState(defaultValues.lat ? String(defaultValues.lat) : '9.94');
  const [lon, setLon] = useState(defaultValues.lon ? String(defaultValues.lon) : '76.16');
  const [activity, setActivity] = useState(defaultValues.activity || 'fishing');
  const [vesselType, setVesselType] = useState(defaultValues.vessel_type || 'motorized_country_craft');
  const [dateOption, setDateOption] = useState('tomorrow');
  const [timeRange, setTimeRange] = useState('morning');
  const [customQuery, setCustomQuery] = useState(
    'Is it safe for a motorized country craft to fish 15km off Kochi tomorrow morning?'
  );

  const [isRecording, setIsRecording] = useState(false);
  const [speechRecognizer, setSpeechRecognizer] = useState(null);
  const [isMapSelectMode, setIsMapSelectMode] = useState(false);

  // Map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Quick Preset Locations
  const presets = [
    { name: 'Kochi, Kerala', lat: 9.94, lon: 76.16, query: 'Motorized fishing 15km off Kochi coast tomorrow morning' },
    { name: 'Mumbai, Maharashtra', lat: 18.96, lon: 72.82, query: 'Trawler coastal operations off Mumbai harbour tomorrow morning' },
    { name: 'Veraval, Gujarat', lat: 20.89, lon: 70.36, query: 'Deep sea mechanized fishing 30km off Veraval coast' },
    { name: 'Puri, Odisha', lat: 19.78, lon: 85.83, query: 'Traditional boat fishing safety off Puri coastline' },
    { name: 'Goa Coast', lat: 15.49, lon: 73.81, query: 'Recreational coastal boating conditions off Goa' },
  ];

  // Speech recognition initialization
  useEffect(() => {
    const recognizer = createSpeechRecognizer({
      onResult: (transcript, isFinal) => {
        setCustomQuery(transcript);
        if (isFinal) setIsRecording(false);
      },
      onError: () => setIsRecording(false),
      onEnd: () => setIsRecording(false),
    });
    setSpeechRecognizer(recognizer);
  }, []);

  const toggleVoice = () => {
    if (!speechRecognizer) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (isRecording) {
      speechRecognizer.stop();
      setIsRecording(false);
    } else {
      try {
        speechRecognizer.start();
        setIsRecording(true);
      } catch (err) {
        console.warn('Speech recognition error:', err);
      }
    }
  };

  // 1. Initialize Interactive Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = parseFloat(lat) || 9.94;
      const initialLon = parseFloat(lon) || 76.16;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLon],
        zoom: 9,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenStreetMap standard tiles (watermark-free)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Marker
      const customPin = L.divIcon({
        className: 'custom-pin',
        html: `
          <div style="position:relative;">
            <div style="background-color:#06b6d4;width:18px;height:18px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 0 14px #06b6d4;"></div>
            <div style="position:absolute;top:-6px;left:-6px;width:30px;height:30px;border-radius:50%;border:2px solid #06b6d4;opacity:0.6;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([initialLat, initialLon], { icon: customPin, draggable: true }).addTo(map);
      markerRef.current = marker;

      // 12 NM Territorial Water buffer
      L.circle([initialLat, initialLon], {
        radius: 22224, // 12 NM
        color: '#0284c7',
        weight: 1.5,
        dashArray: '5, 8',
        fill: false,
        opacity: 0.7,
      }).addTo(map);

      // Map click handler to update coordinates (Image 3 requirement: "The user can click anywhere on the map")
      map.on('click', (e) => {
        const clickedLat = Number(e.latlng.lat.toFixed(4));
        const clickedLon = Number(e.latlng.lng.toFixed(4));
        setLat(String(clickedLat));
        setLon(String(clickedLon));
        marker.setLatLng([clickedLat, clickedLon]);
        map.panTo([clickedLat, clickedLon]);
        setLocationName(`Coord (${clickedLat}°N, ${clickedLon}°E)`);
      });

      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        const draggedLat = Number(pos.lat.toFixed(4));
        const draggedLon = Number(pos.lng.toFixed(4));
        setLat(String(draggedLat));
        setLon(String(draggedLon));
        setLocationName(`Coord (${draggedLat}°N, ${draggedLon}°E)`);
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map marker when lat/lon input changes
  useEffect(() => {
    const pLat = parseFloat(lat);
    const pLon = parseFloat(lon);
    if (!isNaN(pLat) && !isNaN(pLon) && markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([pLat, pLon]);
      mapInstanceRef.current.setView([pLat, pLon], mapInstanceRef.current.getZoom());
    }
  }, [lat, lon]);

  // "Use my location" button
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myLat = Number(pos.coords.latitude.toFixed(4));
        const myLon = Number(pos.coords.longitude.toFixed(4));
        setLat(String(myLat));
        setLon(String(myLon));
        setLocationName('My GPS Coordinates');
        if (mapInstanceRef.current && markerRef.current) {
          markerRef.current.setLatLng([myLat, myLon]);
          mapInstanceRef.current.setView([myLat, myLon], 10);
        }
      },
      (err) => {
        alert('Could not retrieve GPS location: ' + err.message);
      }
    );
  };

  const handleApplyPreset = (p) => {
    setLocationName(p.name);
    setLat(String(p.lat));
    setLon(String(p.lon));
    setCustomQuery(p.query);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    
    // Format ISO date (YYYY-MM-DD) per AnalysisRequest.json contract
    const d = new Date();
    if (dateOption === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    } else if (dateOption === 'day_after') {
      d.setDate(d.getDate() + 2);
    }
    const isoDate = d.toISOString().split('T')[0];

    // Format structured time range object { start, end } per AnalysisRequest.json
    const timeRangeMap = {
      morning: { start: '06:00', end: '11:00' },
      afternoon: { start: '12:00', end: '16:00' },
      evening: { start: '16:00', end: '20:00' },
      night: { start: '20:00', end: '04:00' },
    };
    const structuredTimeRange = timeRangeMap[timeRange] || { start: '06:00', end: '11:00' };

    const payload = {
      query: customQuery || `Is it safe for a ${vesselType.replace(/_/g, ' ')} to conduct ${activity} at ${locationName}?`,
      coordinate: {
        lat: parseFloat(lat) || 9.94,
        lon: parseFloat(lon) || 76.16,
      },
      activity,
      vessel_type: vesselType,
      date: isoDate,
      time_range: structuredTimeRange,
      place_name: locationName,
    };
    onStartAnalyze(payload);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Breadcrumb Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Compass className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Page 2: ORCA Maritime Mission Setup
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Specify your target coastal location, mission activity, and vessel to trigger autonomous multi-agent evaluation
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-3 py-1.5 rounded-lg border border-cyan-800 w-fit">
            Interactive GIS Interface
          </span>
        </div>

        {/* Preset Location Pills */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1">Quick Scenarios:</span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/60 text-slate-300 hover:text-white transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <MapPin className="w-3 h-3 text-cyan-400" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Split Screen Form + Map Layout (Image 3: MAP on left/right + Location inputs) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left 7 Columns: Structured Input Form (Matching Image 2) */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col justify-between space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
              <Ship className="w-4 h-4 text-cyan-400" />
              <span>Operational Parameters</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">Step 2 of 4</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Location Input with Location Buttons */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Target Coastal Location
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g. Kochi, Mumbai, Veraval, Puri"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Coordinates + Helper buttons */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1.5 text-xs font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-400">
                  <span>Lat: <b className="text-cyan-300">{lat}°N</b></span>
                  <span>•</span>
                  <span>Lon: <b className="text-cyan-300">{lon}°E</b></span>
                </div>

                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <LocateFixed className="w-3 h-3 text-cyan-400" />
                  <span>Use my location</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMapSelectMode(!isMapSelectMode)}
                  className={`text-xs px-2.5 py-1 rounded-lg border flex items-center space-x-1 transition-colors cursor-pointer ${
                    isMapSelectMode
                      ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Navigation className="w-3 h-3 text-cyan-400" />
                  <span>Click on map to pin</span>
                </button>
              </div>
            </div>

            {/* 2. Activity & Vessel Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Maritime Activity
                </label>
                <div className="relative">
                  <Fish className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="fishing">🎣 Coastal Fishing</option>
                    <option value="trawling">🚢 Deep Sea Trawling</option>
                    <option value="tourism">🚤 Tourism & Ferry</option>
                    <option value="recreation">🏄 Recreational Water Sports</option>
                    <option value="cargo">📦 Coastal Cargo Transit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Vessel Classification
                </label>
                <div className="relative">
                  <Ship className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={vesselType}
                    onChange={(e) => setVesselType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="motorized_country_craft">FRP Motorized Craft (&lt;10m)</option>
                    <option value="mechanized_fishing_vessel">Mechanized Trawler (&gt;15m)</option>
                    <option value="traditional_non_motorized">Traditional Non-Motorized Canoe</option>
                    <option value="recreational_boat">Speedboat / Recreational Craft</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Date & Time Window */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Assessment Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={dateOption}
                    onChange={(e) => setDateOption(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="tomorrow">📅 Tomorrow (Forecast)</option>
                    <option value="today">📅 Today (Immediate)</option>
                    <option value="day_after">📅 Day After Tomorrow</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Operational Window
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="morning">🌅 Morning (04:00 - 10:00)</option>
                    <option value="afternoon">☀️ Afternoon (12:00 - 16:00)</option>
                    <option value="evening">🌇 Evening (16:00 - 20:00)</option>
                    <option value="night">🌙 Night (20:00 - 04:00)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 4. Natural Language / Voice Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Mission Statement (Voice or Text)
                </label>
                <span className="text-[10px] text-cyan-400 font-mono">NLP Interpreter Active</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="e.g. Can we go fishing 15km off Kochi tomorrow morning?"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-12 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`absolute right-2 top-2 p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isRecording 
                      ? 'bg-rose-500 text-white border-rose-400 animate-pulse' 
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                  title="Speak query"
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Big ANALYZE Button (Matching Mockup) */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-xl shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5 text-slate-950" />
                <span>[ ANALYZE SAFETY ]</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right 6 Columns: Interactive Leaflet Map (Matching Image 3) */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Geospatial Pin Drop Canvas
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Click on the water to position origin
            </span>
          </div>

          <div className="relative flex-1 min-h-[380px] sm:min-h-[440px] rounded-xl overflow-hidden border border-slate-800 shadow-inner">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
            
            {/* Overlay hint */}
            <div className="absolute top-3 left-3 z-[400] bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 shadow-md pointer-events-none">
              <span className="font-bold text-cyan-400">Active Pin:</span> {lat}°N, {lon}°E
            </div>

            <div className="absolute bottom-3 left-3 z-[400] bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-800 text-[10px] text-slate-400 pointer-events-none">
              🔵 Dashed line: 12 NM Territorial Water Limit
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
