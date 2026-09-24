/**
 * ============================================================================
 * ORCA Home & "Ask ORCA" Portal (src/components/HomeAskOrca.jsx)
 * ============================================================================
 * Primary conversational entry point for coastal fishermen and vessel operators.
 * 
 * Architectural Compliance (Architecture Spec §5, §77):
 * 1. Conversational Prompt Interface: Accepts natural language marine queries in English
 *    and Indian regional languages (e.g. "Can I fish off Kochi tomorrow morning?").
 * 2. Voice Querying: Real-time speech-to-text powered by createSpeechRecognizer()
 *    calibrated for low-literacy fisherman access.
 * 3. Quick Asks: Instant pre-baked maritime safety, PFZ, and cyclone check buttons.
 * 4. Refinement Drawer (Collapsible): Optional explicit overrides for coordinates (lat/lon),
 *    port/place name, vessel category, operation activity, and date/time window.
 * 5. Interactive Leaflet Map Picker: Embedded modal map enabling direct tap-to-pinpoint
 *    at sea with automatic coastal gazetteer reverse geocoding.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  Layers,
  Crosshair,
  Loader2
} from 'lucide-react';
import L from 'leaflet';
import { createSpeechRecognizer } from '../utils/speech';
import { getNearestCoastalPlace, resolvePlaceFromCoordinates, resolveCoordinatesFromPlace } from '../utils/geo';
import { ACTIVITIES, VESSEL_TYPES, normalizeActivity, normalizeVesselType } from '../utils/maritimeConfig';

/**
 * Home "Ask ORCA" Component.
 * 
 * @param {Object} props
 * @param {Function} props.onStartAnalysis - Handler to submit analysis payload to backend.
 * @param {Object|null} props.cachedAnalysis - Most recent cached analysis result, if any.
 * @param {Function} props.onViewCached - Handler to jump directly to cached analysis results.
 * @param {string} props.selectedLang - Active language code.
 * @param {Function} props.onSelectLang - Language switch handler.
 */
export default function HomeAskOrca({
  onStartAnalysis,
  cachedAnalysis,
  onViewCached,
  selectedLang = 'en',
  onSelectLang
}) {
  const { t } = useTranslation('ui');
  // Natural language query input state
  const [query, setQuery] = useState('');
  // Refinement drawer expansion toggle
  const [isRefineOpen, setIsRefineOpen] = useState(false);
  // Voice recording state
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

  // Quick asks chips
  const quickAsks = [
    { labelKey: 'home.quickAskSafe',   query: 'Is it safe for motorized fishing off Kochi right now?' },
    { labelKey: 'home.quickAskPfz',    query: 'Where is the nearest Potential Fishing Zone off Kochi coast?' },
    { labelKey: 'home.quickAskAlerts', query: 'Are there any active cyclone or squall warnings near Kochi?' },
    { labelKey: 'home.quickAskTide',   query: 'What are the tidal currents and swell patterns tomorrow morning?' },
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
      alert(t('common.voiceNotSupported'));
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

  const [isResolvingCoords, setIsResolvingCoords] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);

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

  // 1. Forward geocode: place name -> coordinates
  const handleResolveCoordsFromPlace = async () => {
    if (!placeName || !placeName.trim()) return;
    setIsResolvingCoords(true);
    try {
      const result = await resolveCoordinatesFromPlace(placeName);
      if (result) {
        setLat(String(result.lat));
        setLon(String(result.lon));
        if (result.name) setPlaceName(result.name);
        if (markerRef.current) {
          markerRef.current.setLatLng([result.lat, result.lon]);
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([result.lat, result.lon]);
        }
      } else {
        alert(t('home.placeNotFound', 'Location not found in maritime database. You can pin it on the map or enter coordinates.'));
      }
    } catch (err) {
      console.warn('Forward geocoding error:', err);
    } finally {
      setIsResolvingCoords(false);
    }
  };

  // 2. Reverse geocode: coordinates -> place name
  const handleResolvePlaceFromCoords = async () => {
    const pL = parseFloat(lat);
    const pLon = parseFloat(lon);
    if (isNaN(pL) || isNaN(pLon)) return;
    setIsResolvingPlace(true);
    try {
      const immediate = getNearestCoastalPlace(pL, pLon);
      setPlaceName(immediate);
      if (markerRef.current) {
        markerRef.current.setLatLng([pL, pLon]);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo([pL, pLon]);
      }
      const enriched = await resolvePlaceFromCoordinates(pL, pLon);
      if (enriched) setPlaceName(enriched);
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
    } finally {
      setIsResolvingPlace(false);
    }
  };

  // Keep map marker synchronized when lat/lon inputs change
  useEffect(() => {
    const pL = parseFloat(lat);
    const pLon = parseFloat(lon);
    if (!isNaN(pL) && !isNaN(pLon) && markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([pL, pLon]);
    }
  }, [lat, lon]);

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

      requestAnimationFrame(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      });
      timer1 = setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 100);
      timer2 = setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 350);

      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        resizeObserver.observe(mapContainerRef.current);
      }
    } else {
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
      alert(t('common.geolocationNotSupported'));
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
      (err) => alert(t('common.gpsError', { message: err.message }))
    );
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

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

      {/* Cached / Recent Advisory Banner */}
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
                  {t('home.recentAdvisory')}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {cachedAnalysis.analysis_id}
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate mt-0.5">
                {cachedAnalysis.decision?.one_line_recommendation || t('home.noActiveAnalysis')}
              </p>
            </div>
          </div>

          <button
            onClick={() => onViewCached && onViewCached(cachedAnalysis)}
            className="ml-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 text-xs font-semibold flex items-center space-x-1 flex-shrink-0 transition-colors cursor-pointer"
          >
            <span>{t('home.viewAdvisory')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main "Ask ORCA" Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Compass className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {t('home.copilotTitle')}
            </h1>
          </div>
          <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950 px-2.5 py-1 rounded-full border border-cyan-800">
            {t('home.nlpBadge')}
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {t('home.subtitle')}
        </p>

        {/* Input Text Box with Microphone */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('home.placeholder')}
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 pr-14 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder:text-slate-500 resize-none font-medium leading-relaxed"
            />
            <button
              type="button"
              onClick={toggleMic}
              className={`absolute right-3 top-3 p-2.5 rounded-xl border transition-all cursor-pointer ${isRecording
                  ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                }`}
              title={t('home.micTitle')}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>

          {/* Quick-Question Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('home.quickAsksLabel')}</span>
            <div className="flex flex-wrap gap-2">
              {quickAsks.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setQuery(chip.query)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/60 text-xs text-slate-300 hover:text-white transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>{t(chip.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Collapsible Refine Section */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setIsRefineOpen(!isRefineOpen)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white py-2 transition-colors cursor-pointer"
            >
              <span className="flex items-center space-x-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('home.refineLabel')}</span>
              </span>
              {isRefineOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isRefineOpen && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 animate-fade-in">
                {/* Location + GPS + Map Picker */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">{t('home.targetLocation')}</label>
                    <div className="flex items-center space-x-2.5">
                      <button
                        type="button"
                        onClick={handleResolvePlaceFromCoords}
                        disabled={isResolvingPlace || !lat || !lon}
                        title="Reverse lookup coordinates to coastal place name"
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        {isResolvingPlace ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <MapPin className="w-3 h-3" />
                        )}
                        <span>{t('home.getPlace', 'Get Place')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowMapPicker(!showMapPicker)}
                        className={`text-[11px] font-semibold flex items-center space-x-1 px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                          showMapPicker
                            ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                            : 'text-cyan-400 hover:text-cyan-300 border-cyan-900/60 bg-cyan-950/40'
                        }`}
                      >
                        <Navigation className="w-3 h-3" />
                        <span>{showMapPicker ? t('home.hideMap') : t('home.pinOnMap')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleUseMyLocation}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>{t('common.gps')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    {/* Place Name with "Get Coords" Button */}
                    <div className="sm:col-span-6 relative flex items-center">
                      <input
                        type="text"
                        value={placeName}
                        onChange={(e) => setPlaceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleResolveCoordsFromPlace();
                          }
                        }}
                        placeholder={t('home.placeNamePlaceholder')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-24 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={handleResolveCoordsFromPlace}
                        disabled={isResolvingCoords || !placeName.trim()}
                        title="Resolve place name to coordinates"
                        className="absolute right-1.5 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold flex items-center space-x-1 transition-all shadow-sm cursor-pointer"
                      >
                        {isResolvingCoords ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Crosshair className="w-3 h-3" />
                        )}
                        <span>{t('home.getCoords', 'Get Coords')}</span>
                      </button>
                    </div>

                    {/* Latitude */}
                    <div className="sm:col-span-3">
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
                        placeholder={t('home.latPlaceholder')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                      />
                    </div>

                    {/* Longitude */}
                    <div className="sm:col-span-3">
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
                        placeholder={t('home.lonPlaceholder')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Interactive Embedded Leaflet Map */}
                  {showMapPicker && (
                    <div className="mt-3 rounded-2xl overflow-hidden border border-slate-700 relative shadow-inner">
                      <div className="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
                        <span className="font-semibold text-cyan-300 flex items-center space-x-1">
                          <Layers className="w-3.5 h-3.5" />
                          <span>{t('home.mapClickHint')}</span>
                        </span>
                        <span className="font-mono text-slate-400">
                          {lat && lon ? `${lat}°N, ${lon}°E` : t('home.noPin')}
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
                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('home.maritimeActivity')}</label>
                    <select
                      value={activity}
                      onChange={(e) => setActivity(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="">{t('home.selectActivityOptional')}</option>
                      {ACTIVITIES.map((act) => (
                        <option key={act.id} value={act.id}>
                          {t(`activities.${act.id}`, { defaultValue: act.label })}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('home.vesselType')}</label>
                    <select
                      value={vesselType}
                      onChange={(e) => setVesselType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="">{t('home.selectVesselOptional')}</option>
                      {VESSEL_TYPES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {t(`vessels.${v.id}`, { defaultValue: v.label })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('home.date')}</label>
                    <select
                      value={dateOption}
                      onChange={(e) => setDateOption(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="">{t('home.selectDateOptional')}</option>
                      <option value="today">📅 {t('home.today')}</option>
                      <option value="tomorrow">📅 {t('home.tomorrow')}</option>
                      <option value="day_after">📅 {t('home.dayAfter')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('home.timeWindow')}</label>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="">{t('home.selectWindowOptional')}</option>
                      <option value="morning">🌅 {t('home.morning')}</option>
                      <option value="afternoon">☀️ {t('home.afternoon')}</option>
                      <option value="evening">🌇 {t('home.evening')}</option>
                      <option value="night">🌙 {t('home.night')}</option>
                    </select>
                  </div>
                </div>

                {/* Language Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t('home.languageLabel')}</label>
                  <select
                    value={langOverride || selectedLang || 'auto'}
                    onChange={(e) => {
                      setLangOverride(e.target.value);
                      if (onSelectLang) onSelectLang(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="auto">🌐 {t('nav.autoDetect')}</option>
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

          {/* Primary Action Button */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-xl shadow-cyan-500/25 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Sparkles className="w-5 h-5 text-slate-950" />
            <span>{t('home.analyzeButton')}</span>
          </button>
        </form>
      </div>

    </div>
  );
}
