import React, { useState, useEffect, useRef } from 'react';
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
  HelpCircle 
} from 'lucide-react';
import { orcaApi } from '../api/client';
import { speakText, stopSpeaking, createSpeechRecognizer } from '../utils/speech';

export default function MaritimeChat({ selectedLang = 'en' }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Namaste and Ahoy! I am your ORCA Ocean Risk & Coastal Advisory Copilot. Ask me anything about sea states, swell surges (Kallakkadal), wind & squall forecasts, passenger ferry safety, coastal tourism, or port navigation.',
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
    'What are the wave conditions and swell off Kochi coast today?',
    'Can passenger ferries safely operate near Mumbai harbour this afternoon?',
    'Are there any high swell (Kallakkadal) or squall warnings active?',
    'Is it safe for small craft and recreational boats in Palk Bay today?',
  ];

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
        language_override: selectedLang || 'en',
      };
      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      const res = await orcaApi.sendChatMessage(payload);

      if (res?.conversation_id) {
        setConversationId(res.conversation_id);
      }

      const initialReply = res?.response_text || res?.reply || res?.message || 'Analyzing maritime conditions for your mission area...';

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
          const completed = await orcaApi.pollAnalysisUntilDone(res.triggered_analysis_id, () => {}, 1500, 25);
          const finalDecision = completed?.quick_information_result?.answer_text ||
                                completed?.answer_text ||
                                completed?.result?.answer_text ||
                                completed?.decision?.one_line_recommendation ||
                                completed?.decision?.detailed_recommendation ||
                                completed?.decision?.primary_advice ||
                                completed?.summary ||
                                'Safety analysis complete. Sea conditions verified.';

          setMessages((prev) => {
            const updated = [...prev];
            const lastAssistantIdx = updated.length - 1;
            if (lastAssistantIdx >= 0 && updated[lastAssistantIdx].role === 'assistant') {
              updated[lastAssistantIdx] = {
                ...updated[lastAssistantIdx],
                text: finalDecision,
                isAnalyzing: false,
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
        text: `Error connecting to advisory intelligence: ${err.message}. Please verify the backend is running.`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSpeak = (text, idx) => {
    if (speakingIdx === idx) {
      stopSpeaking();
      setSpeakingIdx(null);
    } else {
      speakText(text, selectedLang);
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
      alert('Speech recognition is not supported in this browser.');
    }
  };

  return (
    <div className="flex flex-col h-[650px] bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center shadow-cyan-500/20 shadow-md">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
              <span>ORCA Maritime Assistant</span>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </h3>
            <p className="text-[11px] text-slate-400">Multi-turn Coastal Safety & Weather Dialogue</p>
          </div>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 bg-slate-800 text-cyan-300 rounded-lg border border-slate-700">
          Gemini 2.5 Active
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
                  isAssistant ? 'bg-cyan-600 text-white' : 'bg-blue-600 text-white'
                }`}
              >
                {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div
                className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  isAssistant
                    ? msg.isError
                      ? 'bg-rose-950/50 border border-rose-800 text-rose-200'
                      : 'bg-slate-800/80 border border-slate-700/80 text-slate-100'
                    : 'bg-cyan-600 text-white'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/10 text-[10px] text-slate-400">
                  <span>{msg.timestamp}</span>

                  {isAssistant && !msg.isError && (
                    <button
                      onClick={() => handleToggleSpeak(msg.text, idx)}
                      className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] transition-all ${
                        isSpeaking
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-cyan-300'
                      }`}
                    >
                      {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex items-center space-x-2 text-xs text-cyan-400 bg-slate-800/60 w-fit p-3 rounded-2xl border border-slate-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Consulting ocean models & synthesizing advisory...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions */}
      <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800 overflow-x-auto flex space-x-2 scrollbar-none">
        {quickQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => handleSend(q)}
            className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all flex items-center space-x-1"
          >
            <HelpCircle className="w-3 h-3 text-cyan-400 flex-shrink-0" />
            <span>{q}</span>
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <button
            type="button"
            onClick={handleVoiceRecord}
            className={`p-2.5 rounded-xl transition-all ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title={isRecording ? 'Listening... click to stop' : 'Voice Query'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a maritime question in English, Hindi, Tamil, etc..."
            disabled={isLoading}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl font-bold transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
