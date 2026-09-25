/**
 * ============================================================================
 * ORCA Root Application Component (src/App.jsx)
 * ============================================================================
 * Central application orchestrator, routing manager, and global state coordinator.
 * 
 * Architectural Compliance (Architecture Spec §2, §3, §4, §11, §77):
 * 1. Single Page Application (SPA) state-based routing across 12 distinct maritime views:
 *    - 'landing'  : Page 1 Home / Ask ORCA quick search & voice querying (§5)
 *    - 'input'    : Page 2 Mission setup, coordinates, and interactive map interface (§6)
 *    - 'loading'  : Page 2 Progress live agent swarm telemetry and progress tracking (§6)
 *    - 'results'  : Page 3 Advisory & Decision results hub with DecisionHero (§7 & §8)
 *    - 'route'    : Page 9 Nautical passage planner and waypoint risk engine (§13, §71)
 *    - 'trend'    : Page 11 Decadal oceanographic trend analyzer (§72)
 *    - 'geofence' : Page 10 At-sea geofence monitor and border alert radar (§14)
 *    - 'alerts'   : Page 8 INCOIS / IMD warning subscriptions and notifications (§12, §70)
 *    - 'history'  : Page 7 Local mission and advisory history (§11)
 *    - 'gis'      : Page 6 Interactive GIS maritime layer explorer (§10)
 *    - 'profile'  : Page 14 Vessel profile, vessel length, and sunlight mode settings (§18)
 *    - 'chat'     : Page 5 Dedicated multi-turn maritime copilot (§9)
 * 2. Sunlight Mode high-contrast theme toggle for sunlight-readable at-sea visibility.
 * 3. Dynamic multilingual synchronizer matching UI chrome to the language answered by AI-Service.
 * 4. Resilient polling engine with automatic recovery and honest error reporting.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import OrcaSidebar from './components/OrcaSidebar';
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

/**
 * Root Application Component.
 * 
 * Manages global view switching, theme state, language synchronization,
 * analysis execution polling lifecycle, and history hydration.
 */
export default function App() {
  const { t, i18n } = useTranslation('ui');

  // Active navigation tab state initialized from query parameter (?tab=) or hash (#tab)
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab')) return params.get('tab');
      if (window.location.hash) return window.location.hash.replace('#', '');
    }
    return 'landing';
  });

  // High-contrast sunlight readability toggle for offshore glaring conditions
  const [sunlightMode, setSunlightMode] = useState(false);

  // Selected language code ('auto' or ISO 639-1 like 'hi', 'ta', 'en')
  const [selectedLang, setSelectedLang] = useState('auto');

  // Active analysis data model, polling status, and error states
  const [analysis, setAnalysis] = useState(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Default coordinate and vessel parameters populated when navigating from Home to Input
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
    <div className={`min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex font-sans ${sunlightMode ? 'sunlight-mode' : ''}`}>
      <OrcaSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        sunlightMode={sunlightMode} 
        setSunlightMode={setSunlightMode} 
        selectedLang={selectedLang} 
        setSelectedLang={setSelectedLang} 
      />

      <main className="flex-1 w-full h-screen overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto md:pt-6 pt-16">
          {/* Error Notification Banner */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-lg bg-[var(--dangerous)]/20 border border-[var(--dangerous)] text-[var(--text-primary)] flex items-start justify-between gap-3 shadow-lg">
              <div className="flex items-start space-x-3 min-w-0">
                <AlertCircle className="w-5 h-5 text-[var(--dangerous-bright)] mt-0.5 flex-shrink-0" />
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
                    className="px-2.5 py-1 text-xs bg-[var(--bg-surface)] hover:bg-[var(--border-base)] rounded border border-[var(--border-hover)] font-semibold transition-colors"
                  >
                    Check Status / View Result
                  </button>
                )}
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold cursor-pointer"
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
        </div>
      </main>

      {/* Floating "Ask ORCA" Copilot Button (§86: present on all pages) */}
      <FloatingChatButton
        selectedLang={selectedLang}
        currentAnalysisId={activeAnalysisId}
      />
    </div>
  );
}
