const fs = require('fs');
let c = fs.readFileSync('src/components/DecisionResultsPage.jsx', 'utf8');

c = c.replace(
  "import PointGrid from './PointGrid';",
  "import PointGrid from './PointGrid';\nimport ExpandablePanel from './ExpandablePanel';\nimport { Activity, ShieldAlert, BarChart3, Route, Search, History } from 'lucide-react';"
);

// 1. Grid Risk Distribution
c = c.replace(
  /<div className="bg-\[var\(--bg-surface\)\] border border-\[var\(--border-base\)\].*?>\s*<h3 className="text-\[9px\] font-bold uppercase tracking-widest text-white\/40 mb-3">GRID RISK DISTRIBUTION<\/h3>/g,
  "<ExpandablePanel title=\"GRID RISK DISTRIBUTION\" icon={BarChart3}>"
);

// 2. Active Alerts
c = c.replace(
  /<div className="bg-\[var\(--bg-surface\)\] border border-\[var\(--border-base\)\].*?>\s*<h3 className="text-\[9px\] font-bold uppercase tracking-widest text-\[#D63838\] mb-3 flex items-center space-x-1.5">\s*<span className="w-1.5 h-1.5 rounded-full bg-\[#D63838\] pulse-live" \/>\s*<span>ACTIVE ALERTS<\/span>\s*<\/h3>/g,
  "<ExpandablePanel title={<span className=\"text-[#D63838]\">ACTIVE ALERTS</span>} icon={ShieldAlert} extraHeader={<span className=\"w-1.5 h-1.5 rounded-full bg-[#D63838] pulse-live\" />}>"
);

// 3. Route Intelligence
c = c.replace(
  /<div className="bg-\[var\(--bg-surface\)\] border border-\[var\(--border-base\)\].*?>\s*<h3 className="text-\[9px\] font-bold uppercase tracking-widest text-white\/40 mb-3">ROUTE INTELLIGENCE<\/h3>/g,
  "<ExpandablePanel title=\"ROUTE INTELLIGENCE\" icon={Route}>"
);

// 4. Analysis Sources
c = c.replace(
  /<div className="bg-\[var\(--bg-surface\)\] border border-\[var\(--border-base\)\].*?>\s*<h3 className="text-\[9px\] font-bold uppercase tracking-widest text-white\/40 mb-3">ANALYSIS SOURCES<\/h3>/g,
  "<ExpandablePanel title=\"ANALYSIS SOURCES\" icon={Search}>"
);

// 5. What Changed
c = c.replace(
  /<div className="bg-\[var\(--bg-surface\)\] border border-\[var\(--border-base\)\].*?>\s*<h3 className="text-\[9px\] font-bold uppercase tracking-widest text-white\/40 mb-3">WHAT CHANGED\?<\/h3>/g,
  "<ExpandablePanel title=\"WHAT CHANGED?\" icon={History}>"
);

// Now we need to replace the closing tags for these specific divs with </ExpandablePanel>
// Since it's tricky to regex match closing divs reliably in JSX, we will just use a targeted string replacement for the exact trailing HTML of these cards.

// 1. Grid Risk Distribution ends with: </div>\n                  </div>\n                </div>
c = c.replace(
  /<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*\{\/\* SMART ALERT UI \*\/\}/,
  "</div>\n                  </div>\n                </ExpandablePanel>\n\n                {/* SMART ALERT UI */}"
);

// 2. Active Alerts ends with: </div>\n                  </div>\n                </div>\n                )}
c = c.replace(
  /<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*\)\}\n\n\s*\{\/\* ROUTE INTELLIGENCE \*\/\}/,
  "</div>\n                  </div>\n                </ExpandablePanel>\n                )}\n\n                {/* ROUTE INTELLIGENCE */}"
);

// 3. Route Intelligence ends with: </div>\n                </div>\n                )}
c = c.replace(
  /<\/div>\n\s*<\/div>\n\s*\)\}\n\n\s*\{\/\* ANALYSIS SOURCES \*\/\}/,
  "</div>\n                </ExpandablePanel>\n                )}\n\n                {/* ANALYSIS SOURCES */}"
);

// 4. Analysis Sources ends with: </div>\n                </div>
c = c.replace(
  /<\/div>\n\s*<\/div>\n\n\s*\{\/\* WHAT CHANGED \*\/\}/,
  "</div>\n                </ExpandablePanel>\n\n                {/* WHAT CHANGED */}"
);

// 5. What Changed ends with: </div>\n                </div>\n              </div>\n            </div>
c = c.replace(
  /<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\n\s*\{\/\* Tab 2:/,
  "</div>\n                </ExpandablePanel>\n              </div>\n            </div>\n\n            {/* Tab 2:"
);

fs.writeFileSync('src/components/DecisionResultsPage.jsx', c);
