import re

path = r'C:\Users\arpit\Desktop\main orca\orca new - Copy antg\orca\frontend\src\components\HomeAskOrca.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert new state and useEffect hook
hook_injection = """  const [langOverride, setLangOverride] = useState(selectedLang);

  // AI Service Cold Start Polling
  const [aiState, setAiState] = useState('checking'); // checking | ready | waking | timeout
  const [wakeElapsed, setWakeElapsed] = useState(0);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;
    let pollInterval = null;
    let currentElapsed = 0;

    const runCheck = async () => {
      try {
        const res = await orcaApi.checkHealth();
        if (!mounted) return;
        
        if (res && res.status === 'degraded') {
          setAiState('waking');
          pollInterval = setInterval(async () => {
            currentElapsed += 3;
            if (!mounted) return;
            setWakeElapsed(currentElapsed);
            
            if (currentElapsed >= 90) {
              clearInterval(pollInterval);
              setAiState('timeout');
              return;
            }
            
            const pollRes = await orcaApi.checkHealth();
            if (!mounted) return;
            if (pollRes && pollRes.status !== 'degraded') {
              clearInterval(pollInterval);
              setAiState('ready');
            }
          }, 3000);
        } else {
          setAiState('ready');
        }
      } catch (err) {
        if (mounted) setAiState('ready');
      }
    };

    runCheck();

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [retryTrigger]);"""

content = content.replace("  const [langOverride, setLangOverride] = useState(selectedLang);", hook_injection)

# 2. Replace the Analyze button
old_button = """          {/* Primary Action Button */}
          <button
            type="submit"
            className="w-full py-4 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-black font-black text-sm uppercase tracking-[0.15em] flex items-center justify-center space-x-2 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Sparkles className="w-5 h-5 text-black" />
            <span>{t('home.analyzeButton')}</span>
          </button>"""

new_button = """          {/* Primary Action Button */}
          {aiState === 'timeout' ? (
            <div className="w-full flex flex-col space-y-2 mt-4">
              <div className="text-[12px] text-[var(--caution-text)] bg-[var(--caution-bg)] border border-[var(--caution-border)] p-3 rounded font-medium text-center">
                AI service did not respond after 90s. You can still view history and map data.
              </div>
              <button
                type="button"
                onClick={() => { setAiState('checking'); setWakeElapsed(0); setRetryTrigger(prev => prev + 1); }}
                className="w-full py-4 rounded bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-base)] font-black text-sm uppercase tracking-[0.15em] flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={aiState === 'waking' || aiState === 'checking'}
              className="w-full mt-4 py-4 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-surface-2)] disabled:text-[var(--text-muted)] text-black font-black text-sm uppercase tracking-[0.15em] flex items-center justify-center space-x-2 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none disabled:cursor-not-allowed border disabled:border-[var(--border-base)] border-transparent"
            >
              {aiState === 'waking' ? (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--caution-text)] animate-ping mr-2"></div>
                  <span className="text-[var(--caution-text)]">AI service waking up... {wakeElapsed}s</span>
                </>
              ) : aiState === 'checking' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Checking status...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-black" />
                  <span>{t('home.analyzeButton')}</span>
                </>
              )}
            </button>
          )}"""

content = content.replace(old_button, new_button)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("patched")
