const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

const rawReplacements = {
  'bg-slate-900/90': 'bg-[var(--bg-surface)]',
  'bg-slate-900/80': 'bg-[var(--bg-surface)]',
  'bg-slate-900/70': 'bg-[var(--bg-surface)]',
  'bg-slate-900/60': 'bg-[var(--bg-surface)]',
  'bg-slate-900/50': 'bg-[var(--bg-surface)]',
  'bg-slate-900/40': 'bg-[var(--bg-surface)]',
  'bg-slate-950/90': 'bg-[var(--bg-base)]',
  'bg-slate-950/80': 'bg-[var(--bg-base)]',
  'bg-slate-950/70': 'bg-[var(--bg-base)]',
  'bg-slate-950/60': 'bg-[var(--bg-base)]',
  'bg-slate-950/50': 'bg-[var(--bg-base)]',
  'bg-slate-950/40': 'bg-[var(--bg-base)]',
  'bg-slate-950/30': 'bg-[var(--bg-base)]',
  'bg-slate-800/90': 'bg-[var(--bg-surface-2)]',
  'bg-slate-800/80': 'bg-[var(--bg-surface-2)]',
  'bg-slate-800/60': 'bg-[var(--bg-surface-2)]',
  'bg-slate-800/50': 'bg-[var(--bg-surface-2)]',
  'border-slate-800/80': 'border-[var(--border-base)]',
  'border-slate-800/60': 'border-[var(--border-base)]',
  'border-slate-700/80': 'border-[var(--border-base)]',
  'border-slate-700/60': 'border-[var(--border-base)]',
  'bg-slate-900': 'bg-[var(--bg-surface)]',
  'bg-slate-950': 'bg-[var(--bg-base)]',
  'bg-slate-800': 'bg-[var(--bg-surface-2)]',
  'bg-slate-700': 'bg-[var(--bg-surface-2)]',
  'bg-slate-600': 'bg-[var(--bg-surface-2)]',
  'text-slate-50': 'text-[var(--text-primary)]',
  'text-slate-100': 'text-[var(--text-primary)]',
  'text-slate-200': 'text-[var(--text-primary)]',
  'text-slate-300': 'text-[var(--text-secondary)]',
  'text-slate-400': 'text-[var(--text-secondary)]',
  'text-slate-500': 'text-[var(--text-muted)]',
  'text-white': 'text-[var(--text-primary)]',
  'border-slate-800': 'border-[var(--border-base)]',
  'border-slate-700': 'border-[var(--border-base)]',
  'border-slate-600': 'border-[var(--border-base)]',
  'text-cyan-300': 'text-[var(--accent-primary)]',
  'text-cyan-400': 'text-[var(--accent-primary)]',
  'text-cyan-500': 'text-[var(--accent-primary)]',
  'bg-cyan-400': 'bg-[var(--accent-primary)]',
  'bg-cyan-500': 'bg-[var(--accent-primary)]',
  'bg-cyan-600': 'bg-[var(--accent-primary)]',
  'bg-cyan-950': 'bg-[var(--accent-dim)]',
  'border-cyan-800': 'border-[var(--accent-primary)]',
  'border-cyan-500/60': 'border-[var(--accent-primary)]',
  'hover:bg-cyan-400': 'hover:bg-[var(--accent-hover)]',
  'hover:bg-cyan-500': 'hover:bg-[var(--accent-hover)]',
  'hover:text-cyan-400': 'hover:text-[var(--accent-primary)]',
  'hover:border-cyan-500/60': 'hover:border-[var(--accent-primary)]',
  'ring-cyan-500': 'ring-[var(--accent-primary)]',
  'shadow-cyan-500/20': 'shadow-lg',
  'from-cyan-500': 'from-[var(--accent-primary)]',
  'to-blue-600': 'to-[var(--accent-hover)]',
  'text-emerald-300': 'text-[var(--safe-bright)]',
  'text-emerald-400': 'text-[var(--safe-bright)]',
  'text-emerald-500': 'text-[var(--safe-bright)]',
  'bg-emerald-400': 'bg-[var(--safe)]',
  'bg-emerald-500': 'bg-[var(--safe)]',
  'bg-emerald-950': 'bg-[var(--safe)]/20',
  'border-emerald-800': 'border-[var(--safe)]',
  'text-amber-300': 'text-[var(--caution-bright)]',
  'text-amber-400': 'text-[var(--caution-bright)]',
  'text-amber-500': 'text-[var(--caution-bright)]',
  'bg-amber-400': 'bg-[var(--caution)]',
  'bg-amber-500': 'bg-[var(--caution)]',
  'bg-amber-950': 'bg-[var(--caution)]/20',
  'border-amber-800': 'border-[var(--caution)]',
  'text-rose-300': 'text-[var(--dangerous-bright)]',
  'text-rose-400': 'text-[var(--dangerous-bright)]',
  'text-rose-500': 'text-[var(--dangerous-bright)]',
  'bg-rose-400': 'bg-[var(--dangerous)]',
  'bg-rose-500': 'bg-[var(--dangerous)]',
  'bg-rose-600': 'bg-[var(--dangerous)]',
  'bg-rose-950': 'bg-[var(--dangerous)]/20',
  'border-rose-500': 'border-[var(--dangerous)]',
  'border-rose-800': 'border-[var(--dangerous)]',
  'text-red-400': 'text-[var(--dangerous-bright)]',
  'text-red-500': 'text-[var(--dangerous-bright)]',
  'bg-red-500': 'bg-[var(--dangerous)]',
  'bg-red-600': 'bg-[var(--dangerous)]',
  'text-orange-400': 'text-[var(--unsafe-bright)]',
  'text-orange-500': 'text-[var(--unsafe-bright)]',
  'bg-orange-500': 'bg-[var(--unsafe)]',
  'bg-orange-600': 'bg-[var(--unsafe)]',
  'bg-orange-950': 'bg-[var(--unsafe)]/20',
  'border-orange-800': 'border-[var(--unsafe)]',
  'text-purple-300': 'text-[var(--accent-primary)]',
  'text-purple-400': 'text-[var(--accent-primary)]',
  'bg-purple-600': 'bg-[var(--accent-primary)]',
  'bg-purple-950': 'bg-[var(--accent-dim)]',
  'border-purple-800': 'border-[var(--accent-primary)]',
  'hover:bg-slate-800': 'hover:bg-[var(--bg-surface-2)]',
  'hover:bg-slate-700': 'hover:bg-[var(--bg-surface-2)]',
  'hover:text-white': 'hover:text-[var(--text-primary)]',
  'text-slate-950': 'text-black',
  'from-slate-900': 'from-[var(--bg-surface)]',
  'via-slate-950': 'via-[var(--bg-base)]',
  'to-slate-900': 'to-[var(--bg-surface)]',
  'to-slate-950': 'to-[var(--bg-base)]',
  'from-emerald-500': 'from-[var(--safe)]',
  'from-amber-500': 'from-[var(--caution)]',
  'to-cyan-500': 'to-[var(--accent-primary)]',
  'to-orange-500': 'to-[var(--unsafe)]',
  'shadow-emerald-500/20': 'shadow-lg',
  'shadow-amber-500/20': 'shadow-lg',
  'shadow-rose-500/20': 'shadow-lg'
};

const sortedKeys = Object.keys(rawReplacements).sort((a, b) => b.length - a.length);

files.forEach(file => {
  const skipFiles = ['OrcaSidebar.jsx', 'HomeAskOrca.jsx', 'AnalysisLoadingPage.jsx', 'DecisionResultsPage.jsx', 'DecisionHero.jsx'];
  if (skipFiles.includes(file)) return;

  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = content;

  for (const key of sortedKeys) {
    const value = rawReplacements[key];
    const escapedKey = key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    const regex = new RegExp(`(?<=^|['"\\\`\\\\s])${escapedKey}(?=['"\\\`\\\\s]|$)`, 'g');
    modified = modified.replace(regex, value);
  }
  
  if (modified !== content) {
    fs.writeFileSync(filePath, modified, 'utf8');
    console.log(`Updated ${file}`);
  }
});
