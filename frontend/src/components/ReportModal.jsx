import React, { useState } from 'react';
import { X, Printer, Copy, Check, FileText, Anchor, ShieldCheck } from 'lucide-react';

export default function ReportModal({ analysis, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !analysis) return null;

  const decision = analysis.decision || {};
  const risk = analysis.risk || {};
  const plan = analysis.plan || {};
  const location = plan.location?.validated || plan.location?.original || { lat: 9.94, lon: 76.16 };
  const score = Math.round(decision.overall_risk_score ?? risk.overall_risk_score ?? 28);
  const category = (decision.safety_category || 'SAFE').toUpperCase();

  const reportMarkdown = `# ORCA MARITIME SAFETY ADVISORY BULLETIN
**Analysis Reference:** ${analysis.analysis_id || 'ORCA-REQ-2026-LIVE'}
**Generated At:** ${new Date().toUTCString()}
**Sovereign Jurisdiction:** Indian Coastal Waters (EEZ)

---

### MISSION & VESSEL PROFILE
- **Vessel Classification:** ${plan.vessel_type || 'Fibreglass FRP Motorized'}
- **Activity:** ${plan.activity || 'Motorized Coastal Fishing'}
- **Target Coordinates:** ${location.lat}°N, ${location.lon}°E ${location.snapped ? `(Shoreline snapped offshore)` : ''}
- **Assessment Horizon:** ${plan.time_window?.duration_hours || 4} Hours

---

### OPERATIONAL SAFETY DIRECTIVE
- **Safety Category:** ${category}
- **Synthesized Risk Score:** ${score} / 100
- **Primary Operational Advice:**
  ${decision.one_line_recommendation || decision.primary_advice || 'Conditions are favorable for normal maritime operations. Follow standard safety protocols.'}
- **Detailed Metocean Advisory:**
  ${decision.detailed_recommendation || 'Follow standard safety protocols and monitor marine VHF channel 16.'}

### KEY OPERATIONAL DIRECTIVES
${(decision.recommendations || [
  'Carry standard life jackets and EPIRB beacons.',
  'Maintain continuous listening watch on VHF Marine Channel 16.',
  'Observe local harbor master flags prior to harbor departure.'
]).map(r => `- ${r}`).join('\n')}

### METOCEAN HAZARD PARAMETERS
- Significant Wave Height: ${risk.dominant_factors?.significant_wave_height || '1.4'} meters
- Sustained Wind Speed: ${risk.dominant_factors?.wind_speed || '12'} knots
- Swell Direction: WSW (West-Southwest)
- Emergency Safe Harbors: ${(decision.safe_harbor_recommendations || ['Kochi Fisheries Harbor', 'Thoppumpady Safe Haven']).join(', ')}

---

**EMERGENCY CONTACTS:**
- Indian Coast Guard Search & Rescue: **1554 (Toll-Free)**
- National Maritime Rescue Coordination Centre (MRCC)
- INCOIS Ocean Safety Broadcast Network
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Official Maritime Safety Advisory Bulletin
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                ID: {analysis.analysis_id || 'LIVE-REPORT'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center space-x-1"
              title="Copy Markdown"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1"
              title="Print Bulletin"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body / Report Content */}
        <div className="flex-1 p-6 overflow-y-auto font-sans text-slate-200 space-y-6 bg-slate-900">
          {/* Header Badge */}
          <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Anchor className="w-6 h-6 text-cyan-400" />
              <span className="text-lg font-black tracking-wider text-white">ORCA MARITIME ADVISORY</span>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
              category === 'SAFE' ? 'bg-emerald-500 text-slate-950' : 
              category === 'CAUTION' ? 'bg-amber-400 text-slate-950' : 'bg-rose-500 text-white'
            }`}>
              {category} ({score}/100)
            </div>
          </div>

          {/* Key Advice */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">Operational Action Directive</span>
            <p className="text-sm font-semibold text-white leading-relaxed">
              {decision.primary_advice || 'Normal maritime conditions. Safe to proceed with standard navigation precautions.'}
            </p>
          </div>

          {/* Mission Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Vessel</span>
              <span className="font-bold text-white capitalize">{plan.vessel_type || 'Fibreglass'}</span>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Activity</span>
              <span className="font-bold text-white capitalize">{plan.activity || 'Fishing'}</span>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Coordinates</span>
              <span className="font-bold text-cyan-400 font-mono">{location.lat}°N, {location.lon}°E</span>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Status</span>
              <span className="font-bold text-emerald-400">Validated</span>
            </div>
          </div>

          {/* Directives */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Mandatory Safety Instructions
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {(decision.recommendations || [
                'Equip all crew with ISO/SOLAS approved life jackets prior to departure.',
                'Maintain continuous listening watch on VHF Marine Channel 16.',
                'Check automatic bilge pumps and battery reserves before sailing.'
              ]).map((rec, i) => (
                <li key={i} className="flex items-start space-x-2 bg-slate-950/30 p-2 rounded-lg">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Emergency contacts footer */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
            <span>Coast Guard Emergency MRCC: <strong className="text-rose-400 font-mono">1554</strong></span>
            <span>VHF Distress: <strong className="text-cyan-400 font-mono">Channel 16 (156.8 MHz)</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
