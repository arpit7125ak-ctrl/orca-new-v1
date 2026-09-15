import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HomeAskOrca from './components/HomeAskOrca';
import AnalysisInputPage from './components/AnalysisInputPage';
import AnalysisLoadingPage from './components/AnalysisLoadingPage';
import DecisionResultsPage from './components/DecisionResultsPage';
import RoutePlannerPage from './components/RoutePlannerPage';
import GeofenceMonitor from './components/GeofenceMonitor';
import AlertsPage from './components/AlertsPage';
import HistoryPage from './components/HistoryPage';
import GisExplorer from './components/GisExplorer';
import ProfileSettingsPage from './components/ProfileSettingsPage';
import MaritimeChat from './components/MaritimeChat';
import FloatingChatButton from './components/FloatingChatButton';
import { orcaApi } from './api/client';
import { AlertCircle, Compass, Radio } from 'lucide-react';

export default function App() {
  // Navigation tabs matching frontend_plan.md §3 & §4:
  // 'landing' | 'input' | 'loading' | 'results' | 'route' | 'geofence' | 'alerts' | 'history' | 'gis' | 'profile' | 'chat'
  const [activeTab, setActiveTab] = useState('landing');
  const [sunlightMode, setSunlightMode] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');

  const [analysis, setAnalysis] = useState(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const [inputDefaults, setInputDefaults] = useState({
    place_name: 'Kochi Offshore',
    lat: 9.94,
    lon: 76.16,
    activity: 'fishing',
    vessel_type: 'motorized_country_craft',
  });

  // Load the latest completed analysis from MongoDB on mount
  useEffect(() => {
    async function loadLatest() {
      try {
        const latest = await orcaApi.getLatestAnalysis();
        if (latest && latest.analysis_id && latest.points) {
          setAnalysis(latest);
          setActiveAnalysisId(latest.analysis_id);
          setIsCompleted(true);
        }
      } catch (e) {
        console.warn('Initial analysis pre-fetch:', e);
      }
    }
    loadLatest();
  }, []);

  // Submit analysis from Home or Input Page
  const handleStartAnalyze = async (payload) => {
    setIsLoading(true);
    setIsCompleted(false);
    setErrorMessage(null);
    setActiveTab('loading'); // Transition to Page 2 Progress ("ORCA IS ANALYZING")

    try {
      const created = await orcaApi.createAnalysis(payload);
      const aid = created.analysis_id || created.id;

      if (!aid) {
        throw new Error('Backend did not return an analysis reference.');
      }

      setActiveAnalysisId(aid);
      setStatusInfo({ status: 'running', analysis_id: aid });

      const completedAnalysis = await orcaApi.pollAnalysisUntilDone(
        aid,
        (progress) => {
          setStatusInfo(progress);
        },
        1500,
        35
      );

      setAnalysis(completedAnalysis);
      setIsCompleted(true);
      setIsLoading(false);

      // Auto-transition to Advisory Results Hub
      setTimeout(() => {
        setActiveTab('results');
      }, 1200);

    } catch (err) {
      console.error('Analysis execution failed:', err);
      setErrorMessage(err.message || 'Error occurred during multi-agent analysis.');
      setIsLoading(false);
    }
  };

  const handleSelectHistoryItem = async (item) => {
    try {
      const full = await orcaApi.getAnalysis(item.id);
      setAnalysis(full);
      setActiveAnalysisId(full.analysis_id);
      setActiveTab('results');
    } catch {
      setActiveTab('results');
    }
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950 ${
      sunlightMode ? 'sunlight-mode' : ''
    }`}>
      {/* Universal Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sunlightMode={sunlightMode}
        setSunlightMode={setSunlightMode}
        selectedLang={selectedLang}
        setSelectedLang={setSelectedLang}
      />

      {/* Main Page Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 flex items-start space-x-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-xs sm:text-sm">
              <span className="font-bold">Execution Error: </span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-rose-400 hover:text-white font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Page 1: Home / Ask ORCA (§5) */}
        {activeTab === 'landing' && (
          <HomeAskOrca
            onStartAnalysis={handleStartAnalyze}
            cachedAnalysis={analysis}
            onViewCached={() => setActiveTab('results')}
            selectedLang={selectedLang}
            onSelectLang={setSelectedLang}
          />
        )}

        {/* Page 2: Mission Setup & Map Interface */}
        {activeTab === 'input' && (
          <AnalysisInputPage
            onStartAnalyze={handleStartAnalyze}
            isLoading={isLoading}
            defaultValues={inputDefaults}
          />
        )}

        {/* Page 2 Progress: Live Multi-Agent Swarm Progress ("ORCA IS ANALYZING" §6) */}
        {activeTab === 'loading' && (
          <AnalysisLoadingPage
            analysisId={activeAnalysisId}
            statusInfo={statusInfo}
            isCompleted={isCompleted}
            onViewResults={() => setActiveTab('results')}
          />
        )}

        {/* Page 3: Advisory & Decision Results Hub (§7 & §8) */}
        {activeTab === 'results' && (
          <DecisionResultsPage
            analysis={analysis}
            selectedLang={selectedLang}
            onBackToInput={() => setActiveTab('input')}
            onNewAnalysis={() => setActiveTab('input')}
            onNavigateToTab={setActiveTab}
          />
        )}

        {/* Page 9: Route Planner (§13) */}
        {activeTab === 'route' && (
          <RoutePlannerPage />
        )}

        {/* Page 10: Geofence / At-Sea Mode (§14) */}
        {activeTab === 'geofence' && (
          <GeofenceMonitor />
        )}

        {/* Page 8: Alerts & Subscriptions (§12) */}
        {activeTab === 'alerts' && (
          <AlertsPage />
        )}

        {/* Page 7: My Advisories / History (§11) */}
        {activeTab === 'history' && (
          <HistoryPage onSelectAnalysis={handleSelectHistoryItem} />
        )}

        {/* Page 6: GIS Layers Explorer (§10) */}
        {activeTab === 'gis' && (
          <GisExplorer />
        )}

        {/* Page 14: Profile & Settings (§18) */}
        {activeTab === 'profile' && (
          <ProfileSettingsPage
            sunlightMode={sunlightMode}
            setSunlightMode={setSunlightMode}
            selectedLang={selectedLang}
            setSelectedLang={setSelectedLang}
          />
        )}

        {/* Page 5: Dedicated Chat View (§9) */}
        {activeTab === 'chat' && (
          <div className="max-w-3xl mx-auto">
            <MaritimeChat selectedLang={selectedLang} />
          </div>
        )}
      </main>

      {/* Floating "Ask ORCA" Copilot Button (§86: present on all pages) */}
      <FloatingChatButton
        selectedLang={selectedLang}
        currentAnalysisId={activeAnalysisId}
      />

      {/* Global Maritime Safety Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 backdrop-blur-md py-5 px-4 sm:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-bold text-slate-200">ORCA SIH26176 Maritime Safety Intelligence</span>
            <span>•</span>
            <span>Sections 77 (Fisherman UI), 78 (Explainable AI), and 79 (Visible Multi-Agent Reasoning)</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-slate-400">
              Emergency MRCC: <b className="text-cyan-400">1554</b>
            </span>
            <span>•</span>
            <span className="text-slate-400">
              VHF Guard: <b className="text-cyan-400">CH 16</b>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
