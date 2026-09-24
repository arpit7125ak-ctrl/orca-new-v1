import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  CheckCircle2,
  Crosshair,
  Loader2
} from 'lucide-react';
import L from 'leaflet';
import { createSpeechRecognizer } from '../utils/speech';
import { getNearestCoastalPlace, resolvePlaceFromCoordinates, resolveCoordinatesFromPlace } from '../utils/geo';
import { ACTIVITIES, VESSEL_TYPES, normalizeActivity, normalizeVesselType } from '../utils/maritimeConfig';

export default function AnalysisInputPage({ onStartAnalyze, isLoading, defaultValues = {} }) {
  const { t } = useTranslation('ui');

  // Input fields matching Image 2 & Image 3
  const [locationName, setLocationName] = useState(defaultValues.place_name || '');
  const [lat, setLat] = useState(defaultValues.lat ? String(defaultValues.lat) : '');
  const [lon, setLon] = useState(defaultValues.lon ? String(defaultValues.lon) : '');
  const [activity, setActivity] = useState(defaultValues.activity || '');
  const [vesselType, setVesselType] = useState(defaultValues.vessel_type || '');
  const [dateOption, setDateOption] = useState(defaultValues.date || '');
  const [timeRange, setTimeRange] = useState(defaultValues.time_range || '');
  const [customQuery, setCustomQuery] = useState(defaultValues.query || '');

  const [isRecording, setIsRecording] = useState(false);
  const [speechRecognizer, setSpeechRecognizer] = useState(null);
  const [isMapSelectMode, setIsMapSelectMode] = useState(false);

  // Map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Quick Preset Locations
  const presets = [
    { name: 'Kochi Port, Kerala', lat: 9.93, lon: 76.26, query: 'Motorized fishing 15km off Kochi coast tomorrow morning' },
    { name: 'Mumbai, Maharashtra', lat: 18.96, lon: 72.82, query: 'Trawler coastal operations off Mumbai harbour tomorrow morning' },
    { name: 'Veraval, Gujarat', lat: 20.89, lon: 70.36, query: 'Deep sea mechanized fishing 30km off Veraval coast' },
    { name: 'Rameswaram / Palk Bay', lat: 9.288, lon: 79.313, query: 'Motorized fishing operations in Palk Bay near Rameswaram' },
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
        console.warn('Speech recognition error:', err);
      }
    }
  };

  // 1. Initialize Interactive Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = parseFloat(lat) || 15.0;
      const initialLon = parseFloat(lon) || 75.0;

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

      // Map click handler to update coordinates and place automatically
      map.on('click', (e) => {
        const clickedLat = Number(e.latlng.lat.toFixed(4));
        const clickedLon = Number(e.latlng.lng.toFixed(4));
        handleLocationUpdate(clickedLat, clickedLon, true);
      });

      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        const draggedLat = Number(pos.lat.toFixed(4));
        const draggedLon = Number(pos.lng.toFixed(4));
        handleLocationUpdate(draggedLat, draggedLon, false);
      });

      mapInstanceRef.current = map;

      // Invalidate size on initial mount and animation completion
      requestAnimationFrame(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      });
      const timer = setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 200);

      let resizeObserver;
      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        resizeObserver.observe(mapContainerRef.current);
      }

      return () => {
        if (timer) clearTimeout(timer);
        if (resizeObserver) resizeObserver.disconnect();
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }
  }, []);

  // Centralized coordinate and place synchronizer
  const handleLocationUpdate = async (newLat, newLon, shouldPan = true) => {
    const sLat = String(newLat);
    const sLon = String(newLon);
    setLat(sLat);
    setLon(sLon);

    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLon]);
    }
    if (shouldPan && mapInstanceRef.current) {
      mapInstanceRef.current.panTo([newLat, newLon]);
    }

    // 1. Instant local coastal place fill
    const immediatePlace = getNearestCoastalPlace(newLat, newLon);
    setLocationName(immediatePlace);

    // 2. Automatically update mission query if template
    setCustomQuery((prev) => {
      if (!prev || prev.startsWith('Is it safe for a')) {
        return `Is it safe for a ${vesselType.replace(/_/g, ' ')} to fish off ${immediatePlace}?`;
      }
      return prev;
    });

    // 3. Asynchronously enrich with Nominatim if reachable
    try {
      const enriched = await resolvePlaceFromCoordinates(newLat, newLon);
      if (enriched && enriched !== immediatePlace) {
        setLocationName(enriched);
        setCustomQuery((prev) => {
          if (!prev || prev.startsWith('Is it safe for a')) {
            return `Is it safe for a ${vesselType.replace(/_/g, ' ')} to fish off ${enriched}?`;
          }
          return prev;
        });
      }
    } catch {}
  };

  const [isResolvingCoords, setIsResolvingCoords] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);

  // 1. Forward geocode: place name -> coordinates
  const handleResolveCoordsFromPlace = async () => {
    if (!locationName || !locationName.trim()) return;
    setIsResolvingCoords(true);
    try {
      const result = await resolveCoordinatesFromPlace(locationName);
      if (result) {
        handleLocationUpdate(result.lat, result.lon, true);
        if (result.name) setLocationName(result.name);
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
      setLocationName(immediate);
      const enriched = await resolvePlaceFromCoordinates(pL, pLon);
      if (enriched) setLocationName(enriched);
      if (markerRef.current) markerRef.current.setLatLng([pL, pLon]);
      if (mapInstanceRef.current) mapInstanceRef.current.panTo([pL, pLon]);
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
    } finally {
      setIsResolvingPlace(false);
    }
  };
  useEffect(() => {
    const pLat = parseFloat(lat);
    const pLon = parseFloat(lon);
    if (!isNaN(pLat) && !isNaN(pLon) && markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([pLat, pLon]);
      mapInstanceRef.current.panTo([pLat, pLon]);
    }
  }, [lat, lon]);

  // "Use my location" button
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert(t('common.geolocationNotSupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myLat = Number(pos.coords.latitude.toFixed(4));
        const myLon = Number(pos.coords.longitude.toFixed(4));
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([myLat, myLon], 10);
        }
        handleLocationUpdate(myLat, myLon, true);
      },
      (err) => {
        alert(t('common.gpsError', { message: err.message }));
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

    const trimmedPlace = locationName ? locationName.trim() : '';
    const trimmedQuery = customQuery ? customQuery.trim() : '';
    let queryText = trimmedQuery;
    if (!queryText) {
      const actText = activity ? activity.replace(/_/g, ' ') : 'marine operations';
      const vesText = vesselType ? `for a ${vesselType.replace(/_/g, ' ')} ` : '';
      const locText = trimmedPlace ? `at ${trimmedPlace}` : 'in coastal waters';
      queryText = `Is it safe ${vesText}to conduct ${actText} ${locText}?`;
    }

    const pLat = parseFloat(lat);
    const pLon = parseFloat(lon);
    const hasValidCoords = !isNaN(pLat) && !isNaN(pLon) && pLat >= -90 && pLat <= 90 && pLon >= -180 && pLon <= 180;

    const canonicalActivity = activity ? normalizeActivity(activity) : undefined;
    const canonicalVessel = vesselType ? normalizeVesselType(vesselType) : undefined;

    const payload = {
      query: queryText,
      activity: canonicalActivity || undefined,
      vessel_type: canonicalVessel || undefined,
      date: isoDate,
      time_range: structuredTimeRange,
      coordinate: hasValidCoords ? { lat: pLat, lon: pLon } : undefined,
    };

    if (trimmedPlace) {
      payload.place_name = trimmedPlace;
    }

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
                {t('input.pageTitle')}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {t('input.subtitle')}
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-3 py-1.5 rounded-lg border border-cyan-800 w-fit">
            {t('input.badgeGis')}
          </span>
        </div>

        {/* Preset Location Pills */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1">{t('home.quickScenarios')}:</span>
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

      {/* Split Screen Form + Map Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Structured Input Form */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col justify-between space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
              <Ship className="w-4 h-4 text-cyan-400" />
              <span>{t('input.operationalParameters')}</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">{t('input.stepCounter')}</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Location Input with Location Buttons */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                {t('input.locationSection')}
              </label>
              <div className="relative flex items-center">
                <MapPin className="w-4 h-4 text-cyan-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleResolveCoordsFromPlace();
                    }
                  }}
                  placeholder={t('input.locationPlaceholder')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-28 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleResolveCoordsFromPlace}
                  disabled={isResolvingCoords || !locationName.trim()}
                  title="Resolve place name to coordinates"
                  className="absolute right-2 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
                >
                  {isResolvingCoords ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Crosshair className="w-3.5 h-3.5" />
                  )}
                  <span>{t('home.getCoords', 'Get Coords')}</span>
                </button>
              </div>

              {/* Coordinates Inputs */}
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {t('input.lat')} (°N)
                  </label>
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
                        const nearest = getNearestCoastalPlace(pL, pLon);
                        setLocationName(nearest);
                      }
                    }}
                    placeholder="e.g. 12.5000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {t('input.lon')} (°E)
                  </label>
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
                        const nearest = getNearestCoastalPlace(pL, pLon);
                        setLocationName(nearest);
                      }
                    }}
                    placeholder="e.g. 74.8000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  />
                </div>
              </div>

              {/* Helper Quick Action Buttons */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResolvePlaceFromCoords}
                  disabled={isResolvingPlace || !lat || !lon}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  {isResolvingPlace ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>{t('home.getPlace', 'Get Place Name')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <LocateFixed className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('input.useMyGps')}</span>
                </button>

                <div className="text-[11px] text-cyan-400 font-medium flex items-center space-x-1.5 bg-cyan-950/60 border border-cyan-800/80 px-2.5 py-1.5 rounded-lg">
                  <Navigation className="w-3 h-3 text-cyan-400 animate-pulse" />
                  <span>{t('input.clickToAutoFill')}</span>
                </div>
              </div>
            </div>

            {/* 2. Activity & Vessel Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  {t('input.activity')}
                </label>
                <div className="relative">
                  <Fish className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">{t('home.selectActivityOptional')}</option>
                    {ACTIVITIES.map((act) => (
                      <option key={act.id} value={act.id}>
                        {t(`activities.${act.id}`, { defaultValue: act.label })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  {t('input.vesselType')}
                </label>
                <div className="relative">
                  <Ship className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={vesselType}
                    onChange={(e) => setVesselType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
            </div>

            {/* 3. Date & Time Window */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  {t('input.date')}
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={dateOption}
                    onChange={(e) => setDateOption(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">{t('home.selectDateOptional')}</option>
                    <option value="today">📅 {t('input.today')}</option>
                    <option value="tomorrow">📅 {t('input.tomorrow')}</option>
                    <option value="day_after">📅 {t('home.dayAfter')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  {t('input.timeRange')}
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">{t('home.selectWindowOptional')}</option>
                    <option value="morning">🌅 {t('input.morning')}</option>
                    <option value="afternoon">☀️ {t('input.afternoon')}</option>
                    <option value="evening">🌇 {t('input.evening')}</option>
                    <option value="night">🌙 {t('home.night')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 4. Natural Language / Voice Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {t('input.customQuery')}
                </label>
                <span className="text-[10px] text-cyan-400 font-mono">{t('input.nlpActive')}</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder={t('input.customQueryPlaceholder')}
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
                  title={t('input.voiceInput')}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Big ANALYZE Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-xl shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5 text-slate-950" />
                <span>{isLoading ? t('input.running') : t('input.analyzeButton')}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Interactive Leaflet Map */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {t('input.canvasTitle')}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {t('input.canvasHint')}
            </span>
          </div>

          <div className="relative flex-1 min-h-[380px] sm:min-h-[440px] rounded-xl overflow-hidden border border-slate-800 shadow-inner">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
            
            {/* Overlay hint */}
            <div className="absolute top-3 left-3 z-[400] bg-slate-950/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 shadow-xl pointer-events-none max-w-[85%] truncate">
              <span className="font-bold text-cyan-400">{t('input.targetLabel')}</span> {locationName || t('input.clickWaterHint')}
              {(lat && lon) && (
                <span className="text-slate-400 ml-1.5 font-mono text-[11px]">
                  ({lat}°N, {lon}°E)
                </span>
              )}
            </div>

            <div className="absolute bottom-3 left-3 z-[400] bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-800 text-[10px] text-slate-400 pointer-events-none">
              {t('input.limitNote')}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
