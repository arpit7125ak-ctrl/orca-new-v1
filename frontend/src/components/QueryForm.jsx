import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  SlidersHorizontal, 
  MapPin, 
  Compass, 
  Ship, 
  Fish, 
  Sparkles,
  Navigation
} from 'lucide-react';
import { createSpeechRecognizer } from '../utils/speech';

export default function QueryForm({ onSubmit, isLoading, selectedLang }) {
  const [query, setQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [speechRecognizer, setSpeechRecognizer] = useState(null);

  // Advanced structured overrides
  const [activity, setActivity] = useState('fishing');
  const [vesselType, setVesselType] = useState('motorized_country_craft');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [durationHours, setDurationHours] = useState('');

  // Quick preset chips
  const presets = [
    {
      title: 'Offshore Kochi',
      detail: 'Motorized FRP Boat',
      q: 'Can I go motorized fishing 15km off Kochi tomorrow morning?',
      lat: '9.94',
      lon: '76.16',
      vessel: 'motorized_country_craft',
      act: 'fishing',
    },
    {
      title: 'Veraval, Gujarat',
      detail: 'Mechanized Trawler',
      q: 'Check deep sea fishing conditions 30km off Veraval coast.',
      lat: '20.89',
      lon: '70.36',
      vessel: 'mechanized_fishing_vessel',
      act: 'fishing',
    },
    {
      title: 'Rameswaram, Palk Bay',
      detail: 'Motorized FRP Boat',
      q: 'Is it safe to fish off Rameswaram coast tomorrow?',
      lat: '9.288',
      lon: '79.313',
      vessel: 'motorized_country_craft',
      act: 'fishing',
    },
    {
      title: 'Puri Coast, Odisha',
      detail: 'Traditional Canoe',
      q: 'Is it safe for a traditional non-motorized boat to fish off Puri tomorrow?',
      lat: '19.78',
      lon: '85.83',
      vessel: 'traditional_non_motorized',
      act: 'fishing',
    },
    {
      title: 'Goa Coastal Waters',
      detail: 'Recreational Boat',
      q: 'Recreational boating safety check in Mandovi coastal waters.',
      lat: '15.49',
      lon: '73.81',
      vessel: 'recreational_boat',
      act: 'boating',
    },
  ];

  useEffect(() => {
    const recognizer = createSpeechRecognizer({
      onResult: (transcript, isFinal) => {
        setQuery(transcript);
        if (isFinal) setIsRecording(false);
      },
      onError: () => setIsRecording(false),
      onEnd: () => setIsRecording(false),
    });
    setSpeechRecognizer(recognizer);
  }, []);

  const toggleRecording = () => {
    if (!speechRecognizer) {
      alert('Speech recognition is not supported in this browser. Please type your query.');
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
        console.warn('Speech recognition start failed:', err);
      }
    }
  };

  const handlePreset = (p) => {
    setQuery(p.q);
    setLat(p.lat);
    setLon(p.lon);
    setVesselType(p.vessel);
    setActivity(p.act);
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLon(pos.coords.longitude.toFixed(4));
        setShowAdvanced(true);
      },
      (err) => alert(`Unable to retrieve GPS: ${err.message}`)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() && (!lat || !lon)) return;

    const payload = {};
    if (query.trim()) {
      payload.query = query.trim();
    }
    if (selectedLang) {
      payload.language_override = selectedLang;
    }

    if (showAdvanced || !query.trim()) {
      if (activity) payload.activity = activity;
      if (vesselType) payload.vessel_type = vesselType;
      if (lat && lon) {
        payload.coordinate = {
          lat: parseFloat(lat),
          lon: parseFloat(lon),
        };
      }
    }

    onSubmit(payload);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Main Input Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Ask ORCA Maritime Safety Intelligence</span>
            </label>
            <span className="text-[11px] text-slate-400">Natural Language or Structured Input</span>
          </div>

          <div className="relative flex items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Can I take my 8m fibreglass boat fishing 15km off Kochi tomorrow at 6 AM?"
              disabled={isLoading}
              className="w-full pl-4 pr-24 sm:pr-28 py-3.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all shadow-inner"
            />

            <div className="absolute right-2 flex items-center space-x-1.5">
              {/* Mic Button */}
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-2 rounded-lg transition-all ${
                  isRecording
                    ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400/50'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title={isRecording ? 'Listening... click to stop' : 'Voice Input (Section 77)'}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || (!query.trim() && !lat)}
                className="px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg text-sm flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-cyan-500/20 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Assess</span>
              </button>
            </div>
          </div>
          {isRecording && (
            <p className="text-xs text-rose-400 mt-1.5 font-medium animate-pulse flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              <span>Listening to your voice... Speak your query clearly.</span>
            </p>
          )}
        </div>

        {/* Quick Presets */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Quick Safety Scenarios
            </span>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 font-medium"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{showAdvanced ? 'Hide Advanced Controls' : 'Configure Coordinates & Vessel'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handlePreset(p)}
                className="text-left p-2.5 rounded-xl bg-slate-950/50 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-500/40 transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate">
                  {p.title}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{p.detail}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Overrides Accordion */}
        {showAdvanced && (
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950/40 p-3 rounded-xl">
            {/* Activity */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Fish className="w-3 h-3 text-cyan-400" />
                <span>Maritime Activity</span>
              </label>
              <select
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-cyan-500"
              >
                <option value="fishing">Fishing</option>
                <option value="boating">Boating / Leisure</option>
                <option value="diving">Diving / Underwater Ops</option>
                <option value="marine_research">Marine Research</option>
                <option value="shipping">Commercial Shipping</option>
                <option value="surfing">Surfing / Coastal Watersports</option>
                <option value="tourism">Coastal Tourism</option>
              </select>
            </div>

            {/* Vessel Type */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Ship className="w-3 h-3 text-cyan-400" />
                <span>Vessel Type</span>
              </label>
              <select
                value={vesselType}
                onChange={(e) => setVesselType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-cyan-500"
              >
                <option value="motorized_country_craft">Motorized Country Craft (FRP/Wood)</option>
                <option value="traditional_non_motorized">Traditional Non-Motorized Boat</option>
                <option value="mechanized_fishing_vessel">Mechanized Fishing Vessel / Trawler</option>
                <option value="recreational_boat">Recreational Speedboat</option>
                <option value="research_vessel">Marine Research Vessel</option>
                <option value="large_commercial_vessel">Large Commercial Vessel</option>
              </select>
            </div>

            {/* Lat / Lon */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center space-x-1">
                  <MapPin className="w-3 h-3 text-cyan-400" />
                  <span>Target Coordinates</span>
                </label>
                <button
                  type="button"
                  onClick={handleUseGps}
                  className="text-[10px] text-cyan-400 hover:underline flex items-center space-x-0.5"
                >
                  <Navigation className="w-2.5 h-2.5" />
                  <span>GPS</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="Latitude"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                />
                <input
                  type="number"
                  step="0.0001"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="Longitude"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Compass className="w-3 h-3 text-cyan-400" />
                <span>Voyage Duration (Hours)</span>
              </label>
              <input
                type="number"
                min="1"
                max="72"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                placeholder="e.g. 4"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
