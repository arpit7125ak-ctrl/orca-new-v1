const fs = require('fs');
let c = fs.readFileSync('src/App.jsx', 'utf8');

c = c.replace(
  "import ErrorBoundary from './components/ErrorBoundary';",
  "import ErrorBoundary from './components/ErrorBoundary';\nimport OceanBackground from './components/OceanBackground';"
);

c = c.replace(
  "<div className={`min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex font-sans ${sunlightMode ? 'sunlight-mode' : ''}`}>",
  "<div className={`min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex font-sans ${sunlightMode ? 'sunlight-mode' : ''}`}>\n      {!sunlightMode && <OceanBackground />}"
);

fs.writeFileSync('src/App.jsx', c);
