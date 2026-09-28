import re

path = r'C:\Users\arpit\Desktop\main orca\orca new - Copy antg\orca\frontend\src\App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject state
state_code = """  const { t, i18n } = useTranslation('ui');

  // Booting state to wait for Render free-tier cold starts
  const [isBooting, setIsBooting] = useState(true);
  const [bootAttempt, setBootAttempt] = useState(1);
"""
content = content.replace("  const { t, i18n } = useTranslation('ui');", state_code)

# 2. Inject useEffect for polling
poll_code = """
  // Poll backend health until it wakes up from Render cold start
  useEffect(() => {
    let mounted = true;
    const pollHealth = async () => {
      try {
        const res = await orcaApi.checkHealth();
        if (res && res.status === 'ok') {
          if (mounted) setIsBooting(false);
        } else {
          if (mounted) {
            setBootAttempt(a => a + 1);
            setTimeout(pollHealth, 4000); // Check every 4 seconds
          }
        }
      } catch (e) {
        if (mounted) {
          setBootAttempt(a => a + 1);
          setTimeout(pollHealth, 4000);
        }
      }
    };
    pollHealth();
    return () => { mounted = false; };
  }, []);
"""
content = re.sub(r'(\s*// Active navigation tab state initialized from query parameter)', poll_code + r'\1', content)

# 3. Inject UI rendering
ui_code = """
  // Show boot screen if waiting for servers
  if (isBooting) {
    return (
      <div className="min-h-screen bg-[#0a0d0a] text-white flex flex-col items-center justify-center font-sans relative overflow-hidden">
        <OceanBackground />
        <div className="z-10 flex flex-col items-center">
          <Radio className="w-16 h-16 text-[#22d3ee] animate-pulse mb-6" />
          <h1 className="text-2xl font-black tracking-widest uppercase text-white mb-2">Establishing Secure Link</h1>
          <p className="text-[#8fa688] text-sm text-center max-w-md px-4 leading-relaxed">
            Waking up ORCA maritime servers...<br/>
            <span className="text-xs opacity-70">(Render free tier instances sleep after 15 mins. Cold start may take up to 60 seconds)</span>
          </p>
          <div className="mt-8 flex space-x-1">
            <div className="w-2 h-2 rounded-full bg-[#22d3ee] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-[#22d3ee] animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-[#22d3ee] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <div className="mt-4 text-[10px] text-[#22d3ee] font-mono opacity-50">
            POLL ATTEMPT {bootAttempt} / WAITING FOR SIGNAL...
          </div>
        </div>
      </div>
    );
  }
"""

# Try to insert it before the main return statement (which might be in one of the branches or the main branch).
# Since it might look like `return (\n    <div className={`flex h-screen` (or min-h-screen depending on the version of App.jsx)
content = re.sub(r'(\s*return \(\n\s*<div className=\{`?(flex|min-h-screen))', ui_code + r'\1', content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
