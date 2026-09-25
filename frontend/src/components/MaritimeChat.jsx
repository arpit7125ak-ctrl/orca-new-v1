/**
 * ============================================================================
 * ORCA Dedicated Maritime Chat & Copilot (src/components/MaritimeChat.jsx)
 * ============================================================================
 * Dedicated multi-turn conversational AI interface (Page 5).
 * 
 * Capabilities (Architecture Spec §9, §77):
 * 1. Multi-turn Conversational Memory: Maintains session state backed by server-side
 *    conversation threads (/api/v1/chat/:id) and localStorage fallback.
 * 2. Bi-directional Voice Interaction: Web Speech API speech-to-text voice dictation
 *    and audio text-to-speech advisory playback in all 10 Indic languages.
 * 3. Specialized Maritime Queries: Handles route questions, historical decadal SST trends,
 *    and localized port wave conditions.
 * 4. Inline Rich Artifact Rendering: Renders embedded TrendView and Route result previews
 *    directly inside conversational bubbles.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Send, 
  Bot, 
  User, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Loader2, 
  Sparkles, 
  Ship,
  HelpCircle,
  Navigation,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { orcaApi } from '../api/client';
import { speakText, stopSpeaking, createSpeechRecognizer, localeFor } from '../utils/speech';
import TrendView from './TrendView';

/**
 * Dedicated Maritime Chat Component.
 * 
 * @param {Object} props
 * @param {string} [props.selectedLang='auto'] - Active language code for voice dictation and TTS playback.
 */
export default function MaritimeChat({ selectedLang = 'auto' }) {
  const { t } = useTranslation('ui');

  // Message history array [{ role, text, timestamp, analysis_id }]
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: t('chat.welcomeMessage', { defaultValue: 'Namaste and Ahoy! I am your ORCA Ocean Risk & Coastal Advisory Copilot. Ask me anything about sea states, swell surges, wind & squall forecasts, route safety, or decadal ocean trends.' }),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);

  const quickQuestions = [
    { key: 'q1', text: t('chat.quickQ1', { defaultValue: 'What are the wave conditions and swell off Kochi coast today?' }) },
    { key: 'q2', text: t('chat.quickQ2', { defaultValue: 'Can passenger ferries safely operate near Mumbai harbour this afternoon?' }) },
    { key: 'q3', text: t('chat.quickQ3', { defaultValue: 'Why has fish productivity declined near Ratnagiri over recent years?' }) },
    { key: 'q4', text: t('chat.quickQ4', { defaultValue: 'Is it safe for small craft in Palk Bay today?' }) },
  ];

  // Restore existing conversation from server if available
  useEffect(() => {
    const savedConvId = localStorage.getItem('ORCA_CHAT_CONVERSATION_ID');
    if (savedConvId) {
      setConversationId(savedConvId);
      orcaApi.getConversation(savedConvId).then((res) => {
        if (res && Array.isArray(res.messages) && res.messages.length > 0) {
          const loaded = res.messages.map((m) => ({
            role: m.role,
            text: m.content,
            timestamp: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            analysis_id: m.analysis_id || null,
          }));
          setMessages(loaded);
        }
      }).catch((e) => {
        console.warn('Could not restore chat thread:', e);
      });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend) => {
    const q = textToSend || input;
    if (!q.trim() || isLoading) return;

    const userMsg = {
      role: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const payload = {
        message: q,
      };
      if (selectedLang && selectedLang !== 'auto') {
        payload.language_override = selectedLang;
      }
      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      const res = await orcaApi.sendChatMessage(payload);

      if (res?.conversation_id) {
        setConversationId(res.conversation_id);
        try {
          localStorage.setItem('ORCA_CHAT_CONVERSATION_ID', res.conversation_id);
        } catch (_) {}
      }

      const initialReply = res?.response_text || res?.reply || res?.message || t('chat.analyzingMissionArea', { defaultValue: 'Analyzing maritime conditions for your mission area...' });

      const botMsg = {
        role: 'assistant',
        text: initialReply,
        isAnalyzing: !!res?.triggered_analysis_id,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);

      // If an analysis was triggered, poll until done to display real synthesized advice
      if (res?.triggered_analysis_id) {
        try {
          const completed = await orcaApi.pollAnalysisUntilDone(res.triggered_analysis_id, () => {}, 2000, 300);
          
          let finalDecision = '';
          let trendData = null;
          let routeData = null;

          if (completed?.status === 'failed') {
            finalDecision = completed?.error?.message || t('chat.errorIncompleteParams', { defaultValue: 'Analysis could not be completed with current parameters.' });
          } else if (completed?.final_stage === 'trend' || completed?.trend_result) {
            trendData = completed.trend_result || completed;
            finalDecision = trendData.explanation || t('chat.trendAnalysisComplete', { defaultValue: 'Historical oceanographic trend analysis complete:' });
          } else if (completed?.final_stage === 'route' || completed?.route_result) {
            routeData = completed.route_result || completed;
            finalDecision = `${t('chat.passageAnalysisComplete', { defaultValue: 'Nautical passage analysis complete' })}: ${routeData.total_distance_km ? `${routeData.total_distance_km.toFixed(1)} km` : ''} (${routeData.max_risk_level || t('results.evaluated', { defaultValue: 'Evaluated' })}).`;
          } else {
            finalDecision = completed?.quick_information_result?.answer_text ||
                            completed?.decision?.one_line_recommendation ||
                            completed?.decision?.detailed_recommendation ||
                            completed?.decision?.primary_advice ||
                            t('chat.advisoryAnalysisComplete', { defaultValue: 'Maritime advisory analysis complete.' });
          }

          setMessages((prev) => {
            const updated = [...prev];
            const lastAssistantIdx = updated.length - 1;
            if (lastAssistantIdx >= 0 && updated[lastAssistantIdx].role === 'assistant') {
              updated[lastAssistantIdx] = {
                ...updated[lastAssistantIdx],
                text: finalDecision,
                isAnalyzing: false,
                trend_result: trendData,
                route_result: routeData,
                isError: completed?.status === 'failed',
                language: completed?.response_language || completed?.detected_language || selectedLang,
              };
            }
            return updated;
          });
        } catch (pollErr) {
          console.warn('Chat analysis background poll notice:', pollErr);
        }
      }
    } catch (err) {
      const errorMsg = {
        role: 'assistant',
        text: `${t('chat.errorConnecting', { defaultValue: 'Error connecting to advisory intelligence' })}: ${err.message}. ${t('chat.verifyBackendRunning', { defaultValue: 'Please verify the backend is running.' })}`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSpeak = (text, idx, lang) => {
    if (speakingIdx === idx) {
      stopSpeaking();
      setSpeakingIdx(null);
    } else {
      speakText(text, lang || selectedLang);
      setSpeakingIdx(idx);
      const estTime = Math.max(3000, text.length * 75);
      setTimeout(() => setSpeakingIdx(null), estTime);
    }
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognizer = createSpeechRecognizer({
      lang: selectedLang,
      onResult: (transcript, isFinal) => {
        setInput(transcript);
        if (isFinal) {
          setIsRecording(false);
          handleSend(transcript);
        }
      },
      onError: () => setIsRecording(false),
      onEnd: () => setIsRecording(false),
    });

    if (recognizer) {
      try {
        recognizer.start();
        setIsRecording(true);
      } catch (err) {
        console.warn(err);
      }
    } else {
      alert(t('chat.speechNotAvailable', { locale: localeFor(selectedLang), defaultValue: `Speech recognition is not available for locale ${localeFor(selectedLang)} in this browser.` }));
    }
  };

  return (
    <div className="flex flex-col h-[650px] bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-[var(--bg-base)] border-b border-[var(--border-base)] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-primary)] flex items-center justify-center shadow-lg shadow-md">
            <Bot className="w-5 h-5 text-[var(--text-primary)]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center space-x-1.5">
              <span>{t('chat.assistantTitle', { defaultValue: 'ORCA Maritime Assistant' })}</span>
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)]">{t('chat.dialogueSubtitle', { defaultValue: 'Multi-turn Coastal Safety & Weather Dialogue' })}</p>
          </div>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 bg-[var(--bg-surface-2)] text-[var(--accent-primary)] rounded-lg border border-[var(--border-base)]">
          {t('chat.localeLabel', { defaultValue: 'Locale' })}: {localeFor(selectedLang)}
        </span>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
        {messages.map((msg, idx) => {
          const isAssistant = msg.role === 'assistant';
          const isSpeaking = speakingIdx === idx;

          return (
            <div
              key={idx}
              className={`flex items-start space-x-2.5 max-w-3xl ${
                isAssistant ? '' : 'ml-auto flex-row-reverse space-x-reverse'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  isAssistant ? 'bg-[var(--accent-primary)] text-[var(--text-primary)]' : 'bg-blue-600 text-[var(--text-primary)]'
                }`}
              >
                {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div
                className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  isAssistant
                    ? msg.isError
                      ? 'bg-rose-950/50 border border-[var(--dangerous)] text-rose-200'
                      : 'bg-[var(--bg-surface-2)] border border-[var(--border-base)] text-[var(--text-primary)]'
                    : 'bg-[var(--accent-primary)] text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-1">
                  <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                    {msg.timestamp}
                  </span>
                  {isAssistant && !msg.isAnalyzing && (
                    <button
                      onClick={() => handleToggleSpeak(msg.text, idx, msg.language)}
                      className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] p-0.5 rounded cursor-pointer"
                      title={isSpeaking ? t('chat.stopReading', { defaultValue: 'Stop reading' }) : t('chat.readAloud', { defaultValue: 'Read aloud' })}
                    >
                      {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                <p className="whitespace-pre-line">{msg.text}</p>

                {msg.isAnalyzing && (
                  <div className="mt-2 flex items-center space-x-2 text-[var(--accent-primary)] text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('chat.synthesizingLayers', { defaultValue: 'Synthesizing verified metocean & risk layers...' })}</span>
                  </div>
                )}

                {/* Render Trend Artifact Inline if present */}
                {msg.trend_result && (
                  <div className="mt-4 pt-3 border-t border-[var(--border-base)]">
                    <TrendView trendResult={msg.trend_result} />
                  </div>
                )}

                {/* Render Route Summary Inline if present */}
                {msg.route_result && (
                  <div className="mt-3 p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-base)] text-xs space-y-1">
                    <div className="flex items-center justify-between text-[var(--accent-primary)] font-bold">
                      <span>{t('chat.passageOverview', { defaultValue: 'Nautical Passage Overview' })}</span>
                      <span>{msg.route_result.max_risk_level || t('results.evaluated', { defaultValue: 'Evaluated' })}</span>
                    </div>
                    <p className="text-[var(--text-secondary)]">
                      {t('results.totalDistance', { defaultValue: 'Distance' })}: {msg.route_result.total_distance_km ? `${msg.route_result.total_distance_km.toFixed(1)} km` : '—'} • {t('results.waypoints', { defaultValue: 'Waypoints' })}: {msg.route_result.waypoints?.length || 0}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions */}
      <div className="px-4 py-2 bg-[var(--bg-base)] border-t border-[var(--border-base)] flex items-center space-x-2 overflow-x-auto">
        <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold flex-shrink-0">{t('chat.suggestions', { defaultValue: 'Suggestions:' })}</span>
        {quickQuestions.map((q) => (
          <button
            key={q.key}
            onClick={() => handleSend(q.text)}
            disabled={isLoading}
            className="px-2.5 py-1 bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-2)] border border-[var(--border-base)] rounded-lg text-[11px] text-[var(--text-secondary)] whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
          >
            {q.text}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-4 bg-[var(--bg-base)] border-t border-[var(--border-base)] flex items-center space-x-2">
        <button
          type="button"
          onClick={handleVoiceRecord}
          className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
            isRecording
              ? 'bg-[var(--dangerous)] text-[var(--text-primary)] border-[var(--dangerous)] animate-pulse'
              : 'bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] border-[var(--border-base)]'
          }`}
          title={t('chat.voiceInputTitle', { defaultValue: 'Voice input' })}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('chat.inputPlaceholder', { defaultValue: 'Ask a maritime question in English, Hindi, Tamil, etc. (auto-detect)...' })}
          className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          disabled={isLoading}
        />

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-black font-bold disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
