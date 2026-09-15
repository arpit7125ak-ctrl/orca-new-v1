import React, { useState } from 'react';
import { MessageSquare, X, Bot, Sparkles } from 'lucide-react';
import MaritimeChat from './MaritimeChat';

export default function FloatingChatButton({ selectedLang, currentAnalysisId }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button — Sitting on bottom right of every screen (§86) */}
      <div className="fixed bottom-6 right-6 z-40">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group px-4 py-3.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center space-x-2.5 shadow-2xl shadow-cyan-500/30 transition-all transform hover:-translate-y-1 active:translate-y-0 cursor-pointer"
            title="Open ORCA Maritime AI Copilot"
          >
            <div className="relative">
              <Bot className="w-5 h-5 text-slate-950" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-slate-950 animate-pulse" />
            </div>
            <span className="hidden sm:inline font-bold tracking-tight">Ask ORCA</span>
          </button>
        )}
      </div>

      {/* Floating Chat Drawer / Modal */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] z-50 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-slide-left">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <span>ORCA Maritime Copilot</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </h3>
                <p className="text-[10px] text-slate-400 font-mono">
                  {currentAnalysisId ? `Context: ${currentAnalysisId}` : 'Multilingual Speech & NLP'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
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
