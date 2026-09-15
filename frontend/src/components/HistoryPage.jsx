import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  ArrowRight, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Search,
  Filter
} from 'lucide-react';
import { orcaApi } from '../api/client';

export default function HistoryPage({ onSelectAnalysis }) {
  const [historyItems, setHistoryItems] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Sample and live stored analyses
  useEffect(() => {
    async function loadPastAnalyses() {
      const items = [
        {
          id: 'req_20260914_2131_76bbbc',
          location: 'Veraval Coast, Gujarat',
          date: '14 Sep 2026, 21:31 IST',
          activity: 'Deep Sea Trawling',
          vessel: 'Mechanized Trawler',
          verdict: 'CAUTION',
          recommendation_type: 'go_with_caution',
          score: 48,
          summary: 'Proceed to point P6 with caution due to reduced visibility and gusty winds.',
        },
        {
          id: 'req_20260914_2032_cf62ef',
          location: 'Kochi Offshore, Kerala',
          date: '14 Sep 2026, 20:32 IST',
          activity: 'Coastal Fishing',
          vessel: 'Motorized Country Craft',
          verdict: 'DANGEROUS',
          recommendation_type: 'do_not_venture',
          score: 85,
          summary: 'Do not venture — active IMD squall warning enforces mandatory safety floor.',
        },
        {
          id: 'req_20260913_1420_e812ab',
          location: 'Palk Strait, Tamil Nadu',
          date: '13 Sep 2026, 14:20 IST',
          activity: 'Country Craft Fishing',
          vessel: 'Traditional Canoe',
          verdict: 'SAFE',
          recommendation_type: 'go',
          score: 22,
          summary: 'Safe sea conditions across all sectors. Calms waves (<0.6m) and low breeze.',
        },
      ];

      try {
        const latest = await orcaApi.getLatestAnalysis().catch(() => null);
        if (latest && latest.analysis_id) {
          const exists = items.some((i) => i.id === latest.analysis_id);
          if (!exists) {
            items.unshift({
              id: latest.analysis_id,
              location: latest.plan?.request_context?.place_name || 'Offshore Sector',
              date: 'Recently Completed',
              activity: latest.plan?.request_context?.activity || 'Fishing',
              vessel: latest.plan?.request_context?.vessel_type || 'Motorized Craft',
              verdict: latest.points?.[0]?.risk?.risk_level || 'CAUTION',
              recommendation_type: latest.decision?.recommendation_type || 'go_with_caution',
              score: latest.points?.[0]?.risk?.final_score || 50,
              summary: latest.decision?.one_line_recommendation || 'Mission complete.',
              fullData: latest,
            });
          }
        }
      } catch {}

      setHistoryItems(items);
    }
    loadPastAnalyses();
  }, []);

  const filtered = historyItems.filter((item) => {
    if (filter !== 'ALL' && item.verdict !== filter) return false;
    if (search && !item.location.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getBadgeStyle = (verdict) => {
    switch (verdict) {
      case 'SAFE':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'CAUTION':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      default:
        return 'bg-rose-950 text-rose-300 border-rose-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 sm:py-6">
      
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Clock className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Page 7: My Advisories & Historical Archive
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Review past safety evaluations, operational recommendations, and audited decision traces stored in MongoDB.
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-3 py-1.5 rounded-xl border border-cyan-800 w-fit">
          Auditable Mission History
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by coastal location..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'SAFE', 'CAUTION', 'DANGEROUS'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                filter === f
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* History List (§11) */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 text-xs text-slate-400">
            No historical advisories found matching criteria.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectAnalysis && onSelectAnalysis(item)}
              className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer group shadow-lg backdrop-blur-md space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {item.location}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {item.id}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${getBadgeStyle(item.verdict)}`}>
                    {item.verdict} ({item.score}/100)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{item.date}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {item.summary}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                <span>{item.vessel} • {item.activity}</span>
                <span className="text-cyan-400 font-semibold flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                  <span>Reopen Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
