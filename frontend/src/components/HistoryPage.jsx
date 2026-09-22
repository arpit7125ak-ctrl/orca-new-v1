import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  ArrowRight, 
  RotateCcw, 
  AlertTriangle, 
  Trash2, 
  Search,
  Compass,
  Navigation,
  TrendingUp,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import { orcaApi } from '../api/client';
import { list, remove, clear } from '../utils/history';

export default function HistoryPage({ onSelectAnalysis }) {
  const [historyItems, setHistoryItems] = useState([]);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'point' | 'route' | 'trend' | 'chat'
  const [search, setSearch] = useState('');
  const [unavailableMap, setUnavailableMap] = useState({}); // { [analysis_id]: true }
  const [loadingId, setLoadingId] = useState(null);

  const refreshList = () => {
    setHistoryItems(list());
  };

  useEffect(() => {
    refreshList();
  }, []);

  const handleOpen = async (item) => {
    setLoadingId(item.analysis_id);
    try {
      const full = await orcaApi.getAnalysis(item.analysis_id);
      if (!full || !full.analysis_id) {
        throw new Error('Analysis not found');
      }
      if (onSelectAnalysis) {
        onSelectAnalysis(full);
      }
    } catch (err) {
      console.warn(`Analysis ${item.analysis_id} is no longer available on server:`, err.message);
      setUnavailableMap((prev) => ({ ...prev, [item.analysis_id]: true }));
    } finally {
      setLoadingId(null);
    }
  };

  const handleRemove = (e, id) => {
    e.stopPropagation();
    remove(id);
    refreshList();
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear your local advisory history?')) {
      clear();
      refreshList();
    }
  };

  const filtered = historyItems.filter((item) => {
    if (filter !== 'ALL' && item.kind !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchPlace = (item.place || '').toLowerCase().includes(q);
      const matchId = (item.analysis_id || '').toLowerCase().includes(q);
      if (!matchTitle && !matchPlace && !matchId) return false;
    }
    return true;
  });

  const getKindBadge = (kind) => {
    switch (kind) {
      case 'route':
        return { label: 'Route Plan', bg: 'bg-cyan-950 text-cyan-300 border-cyan-800', icon: Navigation };
      case 'trend':
        return { label: 'Trend Series', bg: 'bg-purple-950 text-purple-300 border-purple-800', icon: TrendingUp };
      case 'chat':
        return { label: 'Chat Query', bg: 'bg-blue-950 text-blue-300 border-blue-800', icon: MessageSquare };
      default:
        return { label: 'Point Advisory', bg: 'bg-emerald-950 text-emerald-300 border-emerald-800', icon: Compass };
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
              Advisory & Mission History
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Local session audit log of recent point analyses, route calculations, and ocean trend evaluations.
          </p>
        </div>
        
        {historyItems.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 text-xs font-semibold transition-colors cursor-pointer w-fit"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by location, title or ID..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'point', label: 'Point' },
            { id: 'route', label: 'Route' },
            { id: 'trend', label: 'Trend' },
            { id: 'chat', label: 'Chat' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                filter === f.id
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 text-slate-400 space-y-2">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No local advisory history yet.</p>
            <p className="text-xs text-slate-500">
              Run a safety assessment, plan a nautical route, or request a trend series to view audit logs here.
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const badge = getKindBadge(item.kind);
            const KindIcon = badge.icon;
            const isUnavailable = unavailableMap[item.analysis_id];
            const isLoadingThis = loadingId === item.analysis_id;

            return (
              <div
                key={item.analysis_id}
                className={`p-5 rounded-3xl bg-slate-900/80 border transition-all shadow-lg backdrop-blur-md space-y-2.5 ${
                  isUnavailable 
                    ? 'border-rose-900/60 bg-rose-950/20' 
                    : 'border-slate-800 hover:border-cyan-500/50'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <KindIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="text-sm font-bold text-white">
                      {item.title || item.place || 'Coastal Analysis'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {item.analysis_id}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-lg border ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.created_at ? new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recent'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                  <div className="flex items-center space-x-1 text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{item.place || 'Coastal Sector'}</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    {isUnavailable ? (
                      <div className="flex items-center space-x-2 text-rose-400">
                        <span className="text-xs">No longer available on server</span>
                        <button
                          onClick={(e) => handleRemove(e, item.analysis_id)}
                          className="px-2 py-0.5 rounded bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 text-[11px] font-semibold cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleOpen(item)}
                          disabled={isLoadingThis}
                          className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          <span>{isLoadingThis ? 'Loading...' : 'Open Result'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleRemove(e, item.analysis_id)}
                          title="Remove from history"
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
