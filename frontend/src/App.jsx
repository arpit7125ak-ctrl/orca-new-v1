import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import TrendPage from './components/TrendPage';
import { orcaApi } from './api/client';
import * as history from './utils/history';
import { AlertCircle, Compass, Radio } from 'lucide-react';

export default function App() {
  const { t, i18n } = useTranslation('ui');
  // Navigation tabs matching frontend_plan.md §3 & §4:
  // 'landing' | 'input' | 'loading' | 'results' | 'route' | 'trend' | 'geofence' | 'alerts' | 'history' | 'gis' | 'profile' | 'chat'
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab')) return params.get('tab');
      if (window.location.hash) return window.location.hash.replace('#', '');
    }
    return 'landing';
  });
  const [sunlightMode, setSunlightMode] = useState(false);
  const [selectedLang, setSelectedLang] = useState('auto');

  const [analysis, setAnalysis] = useState(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const [inputDefaults, setInputDefaults] = useState({
    place_name: '',
    lat: '',
    lon: '',
    activity: '',
    vessel_type: '',
  });

  // On mount: restore the requested or last analysis from history/query
  useEffect(() => {
    async function restoreLast() {
      let targetId = null;
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        targetId = params.get('aid');
      }
      if (!targetId) targetId = history.lastId();
      if (!targetId) return;
      try {
        const res = await orcaApi.getAnalysis(targetId);
        if (res && res.analysis_id) {
          setAnalysis(res);
          setActiveAnalysisId(res.analysis_id);
          setIsCompleted(true);
          const respLang = res.response_language || res.decision?.response_language;
          if (respLang && respLang !== 'auto') {
            i18n.changeLanguage(respLang);
          }
        }
      } catch (e) {
        if (!targetId) history.remove(targetId);
      }
    }
    restoreLast();
  }, []);

  // Submit analysis from Home or Input Page
  const handleStartAnalyze = async (payload) => {
    setIsLoading(true);
    setIsCompleted(false);
    setErrorMessage(null);
    setActiveTab('loading'); // Transition to Page 2 Progress ("ORCA IS ANALYZING")

    try {
      const submissionPayload = { ...payload };
      if (selectedLang && selectedLang !== 'auto') {
        submissionPayload.language_override = selectedLang;
      } else {
        delete submissionPayload.language_override;
      }

      const created = await orcaApi.createAnalysis(submissionPayload);
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
        2000,
        300
      );

      setAnalysis(completedAnalysis);
      setIsCompleted(true);
      setIsLoading(false);

      // Sync UI language with backend response_language
      const respLang = completedAnalysis.response_language || completedAnalysis.decision?.response_language;
      if (respLang && respLang !== 'auto') {
        i18n.changeLanguage(respLang);
      }

      // Record to honest history
      history.addEntry({
        analysis_id: aid,
        kind: 'point',
        title: payload.place_name || payload.query || 'Point Analysis',
        place: payload.place_name || 'Coastal Sector',
        created_at: completedAnalysis.created_at || new Date().toISOString(),
      });

      // Auto-transition to Advisory Results Hub
      setTimeout(() => {
        setActiveTab('results');
      }, 1200);

    } catch (err) {
      console.error('Analysis execution failed:', err);
      const msg = typeof err === 'string'
        ? err
        : (err?.message && err.message !== '[object Object]')
        ? err.message
        : err?.error?.message || (typeof err?.error === 'string' ? err.error : null) || 'Error occurred during multi-agent analysis.';
      setErrorMessage(msg);
      setIsLoading(false);
      setActiveTab((prev) => (prev === 'loading' ? 'input' : prev));
      setStatusInfo(null);
    }
  };

  const handleSelectHistoryItem = (item) => {
    const aid = item.analysis_id || item.id;
    const respLang = item.response_language || item.decision?.response_language;
    if (respLang && respLang !== 'auto' && selectedLang === 'auto') {
      i18n.changeLanguage(respLang);
    }
    if (item.points || item.decision || item.trend_result || item.route_result) {
      setAnalysis(item);
      setActiveAnalysisId(aid);
      setActiveTab('results');
    } else {
      orcaApi.getAnalysis(aid).then((full) => {
        setAnalysis(full);
        setActiveAnalysisId(full.analysis_id);
        const fullLang = full.response_language || full.decision?.response_language;
        if (fullLang && fullLang !== 'auto' && selectedLang === 'auto') {
          i18n.changeLanguage(fullLang);
        }
        setActiveTab('results');
      }).catch((e) => {
        console.warn('Could not open history analysis:', e);
      });
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
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 flex items-start justify-between gap-3 shadow-lg">
            <div className="flex items-start space-x-3 min-w-0">
              <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs sm:text-sm">
                <span className="font-bold">{t('common.executionError', { defaultValue: 'Execution Error: ' })}</span>
                <span>{errorMessage}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2.5 flex-shrink-0">
              {activeAnalysisId && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await orcaApi.getAnalysis(activeAnalysisId);
                      if (res && (res.status === 'completed' || res.status === 'partial')) {
                        setAnalysis(res);
                        setErrorMessage(null);
                        setActiveTab('results');
                      } else {
                        alert(`Analysis ${activeAnalysisId} is still ${res?.status || 'processing'}. Please try again shortly.`);
                      }
                    } catch (e) {
                      alert(`Could not fetch analysis: ${e.message}`);
                    }
                  }}
                  className="px-2.5 py-1 text-xs bg-rose-900/80 hover:bg-rose-800 text-rose-100 rounded-lg border border-rose-700 font-semibold cursor-pointer transition-colors"
                >
                  Check Status / View Result
                </button>
              )}
              <button
                onClick={() => setErrorMessage(null)}
                className="text-xs text-rose-400 hover:text-white font-semibold cursor-pointer"
              >
                {t('common.dismiss', { defaultValue: 'Dismiss' })}
              </button>
            </div>
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
          <RoutePlannerPage selectedLang={selectedLang} />
        )}

        {/* Page 11: Decadal Trends & Multi-Year History (§72) */}
        {activeTab === 'trend' && (
          <TrendPage
            selectedLang={selectedLang}
            onNavigateToTab={setActiveTab}
          />
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
            <span className="font-bold text-slate-200">{t('landing.footerTitle', { defaultValue: 'ORCA SIH26176 Maritime Safety Intelligence' })}</span>
            <span>•</span>
            <span>{t('landing.footerSections', { defaultValue: 'Sections 77 (Fisherman UI), 78 (Explainable AI), and 79 (Visible Multi-Agent Reasoning)' })}</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-slate-400">
              {t('landing.emergencyMrcc', { defaultValue: 'Emergency MRCC:' })} <b className="text-cyan-400">1554</b>
            </span>
            <span>•</span>
            <span className="text-slate-400">
              {t('landing.vhfGuard', { defaultValue: 'VHF Guard:' })} <b className="text-cyan-400">CH 16</b>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
