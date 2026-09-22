import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Mic,
  MicOff,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MapPin,
  Calendar,
  Clock,
  Ship,
  Fish,
  Radio,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Globe,
  SlidersHorizontal,
  Navigation,
  Layers
} from 'lucide-react';
import L from 'leaflet';
import { createSpeechRecognizer } from '../utils/speech';
import { getNearestCoastalPlace, resolvePlaceFromCoordinates } from '../utils/geo';
import { ACTIVITIES, VESSEL_TYPES, normalizeActivity, normalizeVesselType } from '../utils/maritimeConfig';

export default function HomeAskOrca({
  onStartAnalysis,
  cachedAnalysis,
  onViewCached,
  selectedLang = 'en',
  onSelectLang
}) {
  const [query, setQuery] = useState('');
  const [isRefineOpen, setIsRefineOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechRecognizer, setSpeechRecognizer] = useState(null);

  // Refine parameters
  const [placeName, setPlaceName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [activity, setActivity] = useState('');
  const [vesselType, setVesselType] = useState('');
  const [dateOption, setDateOption] = useState('');
  const [timeRange, setTimeRange] = useState('');
  const [langOverride, setLangOverride] = useState(selectedLang);

  // Quick asks chips matching §5
  const quickAsks = [
    { label: 'Safe to fish now?', query: 'Is it safe for motorized fishing off Kochi right now?' },
    { label: 'Nearest PFZ zone', query: 'Where is the nearest Potential Fishing Zone off Kochi coast?' },
    { label: 'Any alerts near me?', query: 'Are there any active cyclone or squall warnings near Kochi?' },
    { label: 'Tide conditions', query: 'What are the tidal currents and swell patterns tomorrow morning?' },
  ];

  // Speech recognition setup
  useEffect(() => {
    const recognizer = createSpeechRecognizer({
      lang: selectedLang,
      onResult: (transcript, isFinal) => {
        setQuery(transcript);
        if (isFinal) setIsRecording(false);
      },
      onError: () => setIsRecording(false),
      onEnd: () => setIsRecording(false),
    });
    setSpeechRecognizer(recognizer);
  }, [selectedLang]);

  const toggleMic = () => {
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
        console.warn('Speech err:', err);
      }
    }
  };

  const [showMapPicker, setShowMapPicker] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const handleLocationUpdate = async (cLat, cLon) => {
    setLat(String(cLat));
    setLon(String(cLon));
    if (markerRef.current) {
      markerRef.current.setLatLng([cLat, cLon]);
    }
    const immediatePlace = getNearestCoastalPlace(cLat, cLon);
    setPlaceName(immediatePlace);

    try {
      const enriched = await resolvePlaceFromCoordinates(cLat, cLon);
      if (enriched) setPlaceName(enriched);
    } catch {}
  };

  useEffect(() => {
    if (!showMapPicker || !mapContainerRef.current) return;

    let resizeObserver;
    let timer1;
    let timer2;

    const initialLat = parseFloat(lat) || 15.0;
    const initialLon = parseFloat(lon) || 75.0;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLon],
        zoom: 8,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const customPin = L.divIcon({
        className: 'custom-pin',
        html: `
          <div style="position:relative;">
            <div style="background-color:#06b6d4;width:16px;height:16px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 10px #06b6d4;"></div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([initialLat, initialLon], { icon: customPin, draggable: true }).addTo(map);
      markerRef.current = marker;

      map.on('click', (e) => {
        const cLat = Number(e.latlng.lat.toFixed(4));
        const cLon = Number(e.latlng.lng.toFixed(4));
        map.panTo([cLat, cLon]);
        handleLocationUpdate(cLat, cLon);
      });

      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        const cLat = Number(pos.lat.toFixed(4));
        const cLon = Number(pos.lng.toFixed(4));
        map.panTo([cLat, cLon]);
        handleLocationUpdate(cLat, cLon);
      });

      mapInstanceRef.current = map;

      // Invalidate size immediately on next tick and after animations complete
      requestAnimationFrame(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      });
      timer1 = setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 100);
      timer2 = setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 350);

      // Auto-refresh tiles whenever container expands or resizes
      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        resizeObserver.observe(mapContainerRef.current);
      }
    } else {
      // Map instance already exists, refresh size
      mapInstanceRef.current.invalidateSize();
    }

    return () => {
      if (timer1) clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
      if (resizeObserver) resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [showMapPicker]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not available.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const cLat = Number(pos.coords.latitude.toFixed(4));
        const cLon = Number(pos.coords.longitude.toFixed(4));
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([cLat, cLon], 10);
        }
        handleLocationUpdate(cLat, cLon);
      },
      (err) => alert('GPS location failed: ' + err.message)
    );
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    // Format ISO date (YYYY-MM-DD) per AnalysisRequest.json contract (only if chosen)
    let isoDate = undefined;
    if (dateOption) {
      const d = new Date();
      if (dateOption === 'tomorrow') {
        d.setDate(d.getDate() + 1);
      } else if (dateOption === 'day_after') {
        d.setDate(d.getDate() + 2);
      }
      isoDate = d.toISOString().split('T')[0];
    }

    // Format structured time range object { start, end } (only if chosen)
    const timeRangeMap = {
      morning: { start: '06:00', end: '11:00' },
      afternoon: { start: '12:00', end: '16:00' },
      evening: { start: '16:00', end: '20:00' },
      night: { start: '20:00', end: '04:00' },
    };
    const structuredTimeRange = timeRange ? timeRangeMap[timeRange] : undefined;

    const trimmedPlace = placeName ? placeName.trim() : '';
    const trimmedQuery = query ? query.trim() : '';
    let finalQuery = trimmedQuery;
    if (!finalQuery) {
      const actText = activity ? activity.replace(/_/g, ' ') : 'marine operations';
      const vesText = vesselType ? `for a ${vesselType.replace(/_/g, ' ')} ` : '';
      const locText = trimmedPlace ? `at ${trimmedPlace}` : 'off coast';
      finalQuery = `Is it safe ${vesText}to conduct ${actText} ${locText}?`;
    }

    const pLat = parseFloat(lat);
    const pLon = parseFloat(lon);
    const hasValidCoords = !isNaN(pLat) && !isNaN(pLon) && pLat >= -90 && pLat <= 90 && pLon >= -180 && pLon <= 180;

    const canonicalActivity = activity ? normalizeActivity(activity) : undefined;
    const canonicalVessel = vesselType ? normalizeVesselType(vesselType) : undefined;

    const payload = {
      query: finalQuery,
      activity: canonicalActivity || undefined,
      vessel_type: canonicalVessel || undefined,
      date: isoDate,
      time_range: structuredTimeRange,
      coordinate: hasValidCoords ? { lat: pLat, lon: pLon } : undefined,
    };

    if (trimmedPlace) {
      payload.place_name = trimmedPlace;
    }
    const chosenLang = langOverride || selectedLang;
    if (chosenLang && chosenLang !== 'auto') {
      payload.language_override = chosenLang;
    }

    onStartAnalysis(payload);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 sm:py-8">

      {/* 1. Cached / Recent Advisory Banner (§5 & §85: show age and offline state) */}
      {cachedAnalysis && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg backdrop-blur-md">
          <div className="flex items-center space-x-3 min-w-0">
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${cachedAnalysis.decision?.recommendation_type === 'go'
                ? 'bg-emerald-400'
                : cachedAnalysis.decision?.recommendation_type === 'go_with_caution'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`} />
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Latest Mission Advisory
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {cachedAnalysis.analysis_id}
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate mt-0.5">
                {cachedAnalysis.decision?.one_line_recommendation || 'Assessment results available.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onViewCached && onViewCached(cachedAnalysis)}
            className="ml-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 text-xs font-semibold flex items-center space-x-1 flex-shrink-0 transition-colors cursor-pointer"
          >
            <span>Resume</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Main "Ask ORCA Anything..." Box (§5 layout) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Compass className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Ask ORCA Marine Copilot
            </h1>
          </div>
          <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950 px-2.5 py-1 rounded-full border border-cyan-800">
            Natural Language Pipeline
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Ask in English, Hindi, Tamil, Telugu, Malayalam, or Bengali. A single natural query is enough — structured fields are optional refinement.
        </p>

        {/* Input Text Box with Microphone */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. kal subah Kochi coast pe fishing safe hai kya? Ya wind speed zyada hai?"
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 pr-14 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder:text-slate-500 resize-none font-medium leading-relaxed"
            />
            <button
              type="button"
              onClick={toggleMic}
              className={`absolute right-3 top-3 p-2.5 rounded-xl border transition-all cursor-pointer ${isRecording
                  ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                }`}
              title="Speak in your regional language"
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>

          {/* Quick-Question Chips (§5: One-tap questions) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick Asks:</span>
            <div className="flex flex-wrap gap-2">
              {quickAsks.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setQuery(chip.query)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/60 text-xs text-slate-300 hover:text-white transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Collapsible "Refine" Section (§5: Optional refinement, not a gate) */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setIsRefineOpen(!isRefineOpen)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white py-2 transition-colors cursor-pointer"
            >
              <span className="flex items-center space-x-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span>▸ Refine (Location, Date, Activity, Vessel Profile)</span>
              </span>
              {isRefineOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isRefineOpen && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 animate-fade-in">
                {/* Location + GPS + Map Picker */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">Target Location</label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowMapPicker(!showMapPicker)}
                        className={`text-[11px] font-semibold flex items-center space-x-1 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                          showMapPicker
                            ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                            : 'text-cyan-400 hover:text-cyan-300 border-cyan-900/60 bg-cyan-950/40'
                        }`}
                      >
                        <Navigation className="w-3 h-3" />
                        <span>{showMapPicker ? 'Hide Map' : 'Pin on Map'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleUseMyLocation}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Use GPS</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={placeName}
                      onChange={(e) => setPlaceName(e.target.value)}
                      placeholder="Place name (auto-filled on map)"
                      className="sm:col-span-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <input
                      type="number"
                      step="0.0001"
                      value={lat}
                      onChange={(e) => {
                        const newLat = e.target.value;
                        setLat(newLat);
                        const pL = parseFloat(newLat);
                        const pLon = parseFloat(lon);
                        if (!isNaN(pL) && !isNaN(pLon) && pL >= -90 && pL <= 90) {
                          setPlaceName(getNearestCoastalPlace(pL, pLon));
                        }
                      }}
                      placeholder="Latitude (e.g. 12.50)"
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                    />
                    <input
                      type="number"
                      step="0.0001"
                      value={lon}
                      onChange={(e) => {
                        const newLon = e.target.value;
                        setLon(newLon);
                        const pL = parseFloat(lat);
                        const pLon = parseFloat(newLon);
                        if (!isNaN(pL) && !isNaN(pLon) && pLon >= -180 && pLon <= 180) {
                          setPlaceName(getNearestCoastalPlace(pL, pLon));
                        }
                      }}
                      placeholder="Longitude (e.g. 74.80)"
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                    />
                  </div>

                  {/* Interactive Embedded Leaflet Map */}
                  {showMapPicker && (
                    <div className="mt-3 rounded-2xl overflow-hidden border border-slate-700 relative shadow-inner">
                      <div className="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
                        <span className="font-semibold text-cyan-300 flex items-center space-x-1">
                          <Layers className="w-3.5 h-3.5" />
                          <span>Click anywhere on water to select origin</span>
                        </span>
                        <span className="font-mono text-slate-400">
                          {lat && lon ? `${lat}°N, ${lon}°E` : 'No pin set'}
                        </span>
                      </div>
                      <div
                        ref={mapContainerRef}
                        className="w-full bg-slate-950 relative z-0"
                        style={{ height: '250px', minHeight: '250px' }}
                      />
                    </div>
                  )}
                </div>

                {/* Activity & Vessel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Maritime Activity (7 options)</label>
                    <select
                      value={activity}
                      onChange={(e) => setActivity(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="">-- Select Maritime Activity (Optional) --</option>
                      {ACTIVITIES.map((act) => (
                        <option key={act.id} value={act.id}>
                          {act.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Vessel Type (6 profiles)</label>
                    <select
                      value={vesselType}
                      onChange={(e) => setVesselType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="">-- Select Vessel Classification (Optional) --</option>
                      {VESSEL_TYPES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Date</label>
                    <select
                      value={dateOption}
                      onChange={(e) => setDateOption(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="">-- Select Date (Optional) --</option>
                      <option value="today">📅 Today (Immediate)</option>
                      <option value="tomorrow">📅 Tomorrow (Forecast)</option>
                      <option value="day_after">📅 Day After Tomorrow</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Time Window</label>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="">-- Select Operational Window (Optional) --</option>
                      <option value="morning">🌅 Morning (06:00 - 11:00 IST)</option>
                      <option value="afternoon">☀️ Afternoon (12:00 - 16:00 IST)</option>
                      <option value="evening">🌇 Evening (16:00 - 20:00 IST)</option>
                      <option value="night">🌙 Night (20:00 - 04:00 IST)</option>
                    </select>
                  </div>
                </div>

                {/* Language Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Query & Response Language (10 Regional Languages)</label>
                  <select
                    value={langOverride || selectedLang || 'auto'}
                    onChange={(e) => {
                      setLangOverride(e.target.value);
                      if (onSelectLang) onSelectLang(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="auto">🌐 Auto-detect Language (Default)</option>
                    <option value="en">English (EN)</option>
                    <option value="hi">हिन्दी (HI)</option>
                    <option value="bn">বাংলা (BN)</option>
                    <option value="ta">தமிழ் (TA)</option>
                    <option value="te">తెలుగు (TE)</option>
                    <option value="or">ଓଡ଼ିଆ (OR)</option>
                    <option value="mr">मराठी (MR)</option>
                    <option value="ml">മലയാളം (ML)</option>
                    <option value="kn">ಕನ್ನಡ (KN)</option>
                    <option value="gu">ગુજરાતી (GU)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Primary Action Button: [ Ask ORCA ] */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-xl shadow-cyan-500/25 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Sparkles className="w-5 h-5 text-slate-950" />
            <span>[ Ask ORCA ]</span>
          </button>
        </form>
      </div>

    </div>
  );
}
