/**
 * ============================================================================
 * ORCA Ubiquitous Floating Copilot Button (src/components/FloatingChatButton.jsx)
 * ============================================================================
 * Persistent floating action button and slide-out chat drawer.
 * 
 * Architectural Compliance (Architecture Spec §86):
 * - Renders across all views so coastal operators can ask clarifying questions at any time.
 * - Passes active analysis context (`currentAnalysisId`) to ground conversation
 *   in the current point or route telemetry.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, X, Bot, Sparkles } from 'lucide-react';
import MaritimeChat from './MaritimeChat';

/**
 * Floating Chat Button & Drawer Component.
 * 
 * @param {Object} props
 * @param {string} props.selectedLang - Active language code for voice dictation and TTS playback.
 * @param {string|null} props.currentAnalysisId - ID of active analysis to contextualize chat.
 */
export default function FloatingChatButton({ selectedLang, currentAnalysisId }) {
  const { t } = useTranslation('ui');
  // Slide-out drawer open/close visibility state
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group px-4 py-3.5 rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-hover)] hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider flex items-center space-x-2.5 shadow-2xl shadow-cyan-500/30 transition-all transform hover:-translate-y-1 active:translate-y-0 cursor-pointer"
            title={t('chat.openCopilotTitle')}
          >
            <div className="relative">
              <Bot className="w-5 h-5 text-black" />
              <span className="w-2 h-2 rounded-full bg-[var(--safe)] absolute -top-0.5 -right-0.5 ring-2 ring-slate-950 animate-pulse" />
            </div>
            <span className="hidden sm:inline font-bold tracking-tight">{t('chat.askOrca')}</span>
          </button>
        )}
      </div>

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] z-50 bg-[var(--bg-surface)] border-l border-[var(--border-base)] shadow-2xl flex flex-col animate-slide-left">
          {/* Drawer Header */}
          <div className="p-4 border-b border-[var(--border-base)] flex items-center justify-between bg-[var(--bg-base)]">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[var(--accent-primary)]">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center space-x-1.5">
                  <span>{t('chat.drawerTitle')}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--safe)]" />
                </h3>
                <p className="text-[10px] text-[var(--text-secondary)] font-mono">
                  {currentAnalysisId ? `${t('chat.context')}: ${currentAnalysisId}` : t('chat.drawerSubtitle')}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Content Body */}
          <div className="flex-1 overflow-y-auto p-3">
            <MaritimeChat selectedLang={selectedLang} />
          </div>
        </div>
      )}
    </>
  );
}
