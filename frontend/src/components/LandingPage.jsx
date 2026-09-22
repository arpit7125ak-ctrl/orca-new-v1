import React from 'react';
import { 
  Anchor, 
  ArrowRight, 
  CloudSun, 
  Waves, 
  ShieldAlert, 
  Scale, 
  Cpu, 
  Compass, 
  CheckCircle2, 
  Play, 
  MapPin, 
  Radio 
} from 'lucide-react';

export default function LandingPage({ onStartAnalysis, onQuickSelect }) {
  const pillars = [
    { label: 'Weather', icon: CloudSun, color: 'text-amber-400', desc: 'IMD numerical weather prediction & gust models' },
    { label: 'Ocean', icon: Waves, color: 'text-cyan-400', desc: 'INCOIS wave, swell, and ocean current dynamics' },
    { label: 'Ecosystem', icon: ShieldAlert, color: 'text-emerald-400', desc: 'Marine sanctuaries & IMBL international boundary GIS' },
    { label: 'Risk', icon: Scale, color: 'text-purple-400', desc: 'Deterministic constraint floors & multi-agent reasoning' },
  ];

  const presets = [
    { title: 'Offshore Kochi', vessel: 'Motorized Country Craft', loc: { lat: 9.93, lon: 76.26 } },
    { title: 'Veraval Coast', vessel: 'Mechanized Trawler', loc: { lat: 20.89, lon: 70.36 } },
    { title: 'Palk Strait', vessel: 'Traditional Canoe', loc: { lat: 9.50, lon: 79.52 } },
  ];

  return (
    <div className="space-y-12 py-6 sm:py-12">
      {/* Hero Section — Matching Image 1 from Document */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 p-8 sm:p-16 text-center shadow-2xl backdrop-blur-md">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent pointer-events-none" />
        
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/80 text-xs font-semibold text-cyan-300 mb-6 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>SIH26176 Autonomous Multi-Agent Maritime Platform</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight max-w-4xl mx-auto">
          Understand the Ocean <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
            Before You Enter It.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          AI-powered marine ecosystem reasoning with deterministic safety floors and visible multi-agent decision pipelines for coastal fishermen and maritime authorities.
        </p>

        {/* CTA Button — [ Start Analysis ] */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onStartAnalysis}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-base flex items-center justify-center space-x-3 transition-all shadow-xl shadow-cyan-500/25 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <span>Start Analysis</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Core Pillars: Weather • Ocean • Ecosystem • Risk */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 max-w-3xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            {pillars.map((p, idx) => {
              const Icon = p.icon;
              return (
                <div key={idx} className="bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/60">
                  <div className="flex items-center space-x-2 mb-1">
                    <Icon className={`w-4 h-4 ${p.color}`} />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">{p.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quick Launch Mission Presets */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Instant Mission Screening Scenarios</span>
            </h3>
            <p className="text-xs text-slate-400">Jump directly into evaluated coastal zones</p>
          </div>
          <button
            onClick={onStartAnalysis}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1"
          >
            <span>Custom Coordinate</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {presets.map((p, idx) => (
            <div
              key={idx}
              onClick={() => onQuickSelect && onQuickSelect(p)}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer group shadow-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{p.title}</span>
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {p.loc.lat}°N, {p.loc.lon}°E
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">{p.vessel}</p>
              <div className="text-[11px] font-bold text-cyan-400 flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                <span>Evaluate Safety</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* System Highlights for Judges */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">Section 79: Visible Multi-Agent Execution</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Planner, Weather, Ocean, Cyclone, GIS, Risk, and Decision agents collaborate with transparent durations and auditable traces.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Scale className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">Section 78: Explainable AI & Safety Floors</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Deterministic IMD warnings enforce hard safety floors that the LLM cannot override, ensuring life-critical reliability on the sea.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">Section 77: Fisherman High-Contrast Deck UI</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Traffic-light verdicts, voice speech in Indian regional languages (Hindi, Tamil, Telugu, Malayalam, Bengali), and Sunlight Mode.
          </p>
        </div>
      </section>
    </div>
  );
}
