import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, X, MapPin, Clock, ShieldAlert } from 'lucide-react';

export default function SosManager({ analysis, activeTab }) {
  const { t } = useTranslation('ui');
  const [isOpen, setIsOpen] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [sosState, setSosState] = useState({
    isActive: false,
    type: 'Distress',
    activationTime: null,
    coordinates: null
  });

  const [selectedType, setSelectedType] = useState('Distress');
  const timerRef = useRef(null);

  const emergencyTypes = [
    'Distress',
    'Medical Emergency',
    'Man Overboard',
    'Fire / Collision',
    'Vessel Failure',
    'Other'
  ];

  const handlePointerDown = (e) => {
    e.preventDefault();
    setIsHolding(true);
    setHoldProgress(0);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / 2000) * 100, 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(timerRef.current);
        activateSos();
      }
    }, 50);
  };

  const handlePointerUp = (e) => {
    e.preventDefault();
    setIsHolding(false);
    setHoldProgress(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const activateSos = () => {
    // Get current coords if available
    const plan = analysis?.plan || {};
    let lat = plan.location?.validated?.lat != null ? Number(plan.location.validated.lat) : Number(plan.location?.original?.lat);
    let lon = plan.location?.validated?.lon != null ? Number(plan.location.validated.lon) : Number(plan.location?.original?.lon);

    if (isNaN(lat)) lat = analysis?.route?.waypoints?.[0]?.lat;
    if (isNaN(lon)) lon = analysis?.route?.waypoints?.[0]?.lon;

    setSosState({
      isActive: true,
      type: selectedType,
      activationTime: new Date().toLocaleTimeString(),
      coordinates: (Number.isFinite(lat) && Number.isFinite(lon)) ? { lat, lon } : null
    });
    setIsOpen(false);
    
    // Inject SOS state globally so map can read it
    window.ORCA_SOS_ACTIVE = true;
    window.ORCA_SOS_COORDS = (Number.isFinite(lat) && Number.isFinite(lon)) ? [lat, lon] : null;
    window.dispatchEvent(new Event('orca-sos-changed'));
  };

  const cancelSos = () => {
    if (window.confirm('CANCEL SOS? Are you sure you want to cancel the emergency SOS?')) {
      setSosState({ isActive: false, type: null, activationTime: null, coordinates: null });
      window.ORCA_SOS_ACTIVE = false;
      window.ORCA_SOS_COORDS = null;
      window.dispatchEvent(new Event('orca-sos-changed'));
    }
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-[9999] flex items-center space-x-3 pointer-events-auto">
        <div className="hidden sm:flex items-center bg-[var(--bg-surface)]/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[var(--border-base)] shadow-sm space-x-2">
           <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
           <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-500">Live Data</span>
        </div>

        {!sosState.isActive ? (
          <button 
            onClick={() => setIsOpen(true)}
            className="bg-[var(--dangerous)] hover:bg-[var(--dangerous-bright)] text-white px-4 py-1.5 rounded-lg border border-[var(--dangerous-bright)] shadow-[0_0_15px_rgba(239,68,68,0.5)] font-black tracking-widest text-sm flex items-center space-x-2 transition-all cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>SOS</span>
          </button>
        ) : (
          <button 
            onClick={cancelSos}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg border border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.8)] font-black tracking-widest text-sm flex items-center space-x-2 cursor-pointer animate-pulse"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>SOS ACTIVE</span>
          </button>
        )}
      </div>

      {isOpen && !sosState.isActive && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--dangerous)] rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-[var(--dangerous)]/10 px-6 py-4 border-b border-[var(--dangerous)]/30 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-6 h-6 text-[var(--dangerous-bright)] animate-pulse" />
                <h2 className="text-lg font-black text-[var(--dangerous-bright)] uppercase tracking-widest">Emergency SOS</h2>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-[var(--text-primary)] font-medium mb-6 leading-relaxed">
                Are you sure you want to activate the emergency SOS procedure?
              </p>

              <div className="space-y-3 mb-8">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Emergency Type</div>
                <div className="grid grid-cols-2 gap-2">
                  {emergencyTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`px-3 py-2 text-xs font-bold rounded border transition-all ${
                        selectedType === type
                          ? 'bg-[var(--dangerous)]/20 border-[var(--dangerous)] text-[var(--dangerous-bright)]'
                          : 'bg-[var(--bg-base)] border-[var(--border-base)] text-[var(--text-secondary)] hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-3 rounded-lg border border-[var(--border-base)] text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-base)] hover:text-white transition"
                >
                  CANCEL
                </button>
                <div className="relative flex-1">
                  <button
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onContextMenu={e => e.preventDefault()}
                    className="w-full h-full relative overflow-hidden px-4 py-3 rounded-lg border border-[var(--dangerous-bright)] bg-[var(--dangerous)] text-white text-sm font-black tracking-widest select-none touch-none"
                  >
                    <span className="relative z-10">HOLD TO ACTIVATE</span>
                    <div 
                      className="absolute inset-0 bg-red-600 transition-all duration-75 origin-left"
                      style={{ transform: `scaleX(${holdProgress / 100})` }}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SOS Active Overlay Panel (Persistent local state indicator) */}
      {sosState.isActive && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9990] bg-red-950/90 backdrop-blur-md border border-red-500 rounded-2xl p-5 shadow-[0_0_30px_rgba(220,38,38,0.3)] w-[90%] max-w-md flex flex-col pointer-events-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-500 font-black tracking-widest text-lg">SOS ACTIVE</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-red-500/50 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">Local ORCA Status</span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-[9px] font-bold text-red-400/70 uppercase tracking-wider mb-1">Emergency</div>
              <div className="text-sm font-bold text-white">{sosState.type}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-red-400/70 uppercase tracking-wider mb-1 flex items-center"><Clock className="w-3 h-3 mr-1"/> Time</div>
              <div className="text-sm font-bold text-white">{sosState.activationTime}</div>
            </div>
          </div>

          {sosState.coordinates ? (
            <div className="bg-red-900/30 rounded border border-red-500/30 p-3 flex items-start space-x-3">
              <MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Known Position</div>
                <div className="text-xs font-mono text-white">
                  {sosState.coordinates.lat.toFixed(5)}° N<br/>
                  {sosState.coordinates.lon.toFixed(5)}° E
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-red-400 font-medium">GPS Position Unavailable</div>
          )}

          <div className="mt-4 text-[10px] text-red-300/70 text-center font-medium">
            Note: This device currently has NO satellite uplink. Signal is only broadcasting locally to nearby ORCA nodes.
          </div>
        </div>
      )}
    </>
  );
}
