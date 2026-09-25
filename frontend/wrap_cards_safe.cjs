const fs = require('fs');
let c = fs.readFileSync('src/components/DecisionResultsPage.jsx', 'utf8');

if (!c.includes('ExpandablePanel')) {
  c = c.replace(
    "import PointGrid from './PointGrid';",
    "import PointGrid from './PointGrid';\nimport ExpandablePanel from './ExpandablePanel';\nimport { Activity, ShieldAlert, BarChart3, Route, Search, History } from 'lucide-react';"
  );
}

// Just replace the wrappers manually one by one
// 1. Grid Risk Distribution
c = c.replace(
  /<div className="bg-\[var\(--bg-surface\)\].*?">\s*<h3 className="text-\[9px\] font-bold uppercase tracking-widest text-white\/40 mb-3">GRID RISK DISTRIBUTION<\/h3>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g,
  '<ExpandablePanel title="GRID RISK DISTRIBUTION" icon={BarChart3}>$1</div>\n                  </div>\n                </ExpandablePanel>'
);

// 2. Active Alerts
c = c.replace(
  /<div className="bg-\[var\(--bg-surface\)\].*?">\s*<h3 className="text-\[9px\].*?>\s*<span className="w-1.5 h-1.5 rounded-full bg-\[#D63838\] pulse-live".*?>\s*<span>ACTIVE ALERTS<\/span>\s*<\/h3>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*\)\}/g,
  '<ExpandablePanel title={<span className="text-[#D63838]">ACTIVE ALERTS</span>} icon={ShieldAlert} extraHeader={<span className="w-1.5 h-1.5 rounded-full bg-[#D63838] pulse-live" />}>$1</div>\n                  </div>\n                </ExpandablePanel>)}'
);

// 3. Route Intelligence
c = c.replace(
  /<div className="bg-\[var\(--bg-surface\)\].*?">\s*<h3 className="text-\[9px\] font-bold uppercase tracking-widest text-white\/40 mb-3">ROUTE INTELLIGENCE<\/h3>([\s\S]*?)<\/div>\s*<\/div>\s*\)\}/g,
  '<ExpandablePanel title="ROUTE INTELLIGENCE" icon={Route}>$1</div>\n                </ExpandablePanel>)}'
);

// 4. Analysis Sources
c = c.replace(
  /<div className="bg-\[var\(--bg-surface\)\].*?">\s*<h3 className="text-\[9px\] font-bold uppercase tracking-widest text-white\/40 mb-3">ANALYSIS SOURCES<\/h3>([\s\S]*?)<\/div>\s*<\/div>/g,
  '<ExpandablePanel title="ANALYSIS SOURCES" icon={Search}>$1</div>\n                </ExpandablePanel>'
);

// 5. What Changed
c = c.replace(
  /<div className="bg-\[var\(--bg-surface\)\].*?">\s*<h3 className="text-\[9px\] font-bold uppercase tracking-widest text-white\/40 mb-3">WHAT CHANGED\?<\/h3>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g,
  '<ExpandablePanel title="WHAT CHANGED?" icon={History}>$1</div>\n                </ExpandablePanel>\n              </div>\n            </div>'
);

fs.writeFileSync('src/components/DecisionResultsPage.jsx', c);
