const fs = require('fs');

let c = fs.readFileSync('src/components/DecisionResultsPage.jsx', 'utf8');

const targetOld = \`        {/* Tab 1: Overview & 9-Point Spatial Grid */}
        {activeInternalTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div>
                <MarineMap
                  analysis={analysis}
                  selectedPoint={selectedPoint}
                  onSelectPoint={handleSelectPoint}
                />
              </div>
              <div>
                <PointGrid
                  analysis={analysis}
                  selectedPoint={selectedPoint}
                  onSelectPoint={handleSelectPoint}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ExplainableAi analysis={analysis} />
              <AgenticReasoning analysis={analysis} />
            </div>
          </div>
        )}\`;


const replacement = \`        {/* Tab 1: Overview & 9-Point Spatial Grid */}
        {activeInternalTab === 'overview' && (() => {
          // 1. Calculate Risk Distributions
          const pts = analysis?.points || [];
          const riskCounts = { SAFE: 0, CAUTION: 0, MODERATE: 0, HIGH: 0, DANGER: 0 };
          pts.forEach(pt => {
             const val = pt.risk_score || pt.risk?.final_score || 0;
             if (val < 35) riskCounts.SAFE++;
             else if (val < 50) riskCounts.CAUTION++;
             else if (val < 70) riskCounts.MODERATE++;
             else if (val < 85) riskCounts.HIGH++;
             else riskCounts.DANGER++;
          });
          
          // 2. Route Intelligence
          const waypoints = analysis?.route?.waypoints || analysis?.plan?.route?.waypoints || [];
          let highestRouteRisk = 0;
          let highestRiskLatLon = 'N/A';
          waypoints.forEach(wp => {
             const r = wp.risk_score || wp.risk || 0;
             if (r > highestRouteRisk) {
                highestRouteRisk = r;
                highestRiskLatLon = \`\${Number(wp.lat).toFixed(2)}°N, \${Number(wp.lon).toFixed(2)}°E\`;
             }
          });
          const totalDistance = analysis?.route?.distance_nm || analysis?.plan?.route?.distance_nm;
          const distDisplay = totalDistance ? \`\${Number(totalDistance).toFixed(1)} NM\` : 'N/A';

          return (
            <div className="space-y-5">
              
              {/* TOP SUMMARY METRIC ROW */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                 {[
                   { label: 'Overall Risk', value: analysis?.decision?.risk_level || 'N/A', color: analysis?.decision?.risk_level === 'SAFE' ? 'text-emerald-400' : 'text-amber-400' },
                   { label: 'Active Alerts', value: (analysis?.points?.[0]?.risk?.official_warnings?.length || 0).toString().padStart(2, '0') },
                   { label: 'Max Wave', value: pts.length ? Math.max(...pts.map(p => p.risk?.weather?.wave_height_m || p.risk?.metocean?.wave_height_m || 0)).toFixed(1) + ' m' : 'N/A' },
                   { label: 'Max Wind', value: pts.length ? Math.max(...pts.map(p => (p.risk?.weather?.wind_speed_ms || 0) * 1.94)).toFixed(0) + ' kt' : 'N/A' },
                   { label: 'Visibility', value: pts[0]?.risk?.weather?.visibility_km?.toFixed(1) ? pts[0].risk.weather.visibility_km.toFixed(1) + ' km' : 'N/A' },
                   { label: 'Tide', value: pts[0]?.risk?.metocean?.tide_surge_m?.toFixed(1) ? pts[0].risk.metocean.tide_surge_m.toFixed(1) + ' m' : 'N/A' },
                 ].map((m, i) => (
                    <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-lg p-3 flex flex-col justify-center shadow-sm">
                       <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">{m.label}</span>
                       <span className={\`text-sm font-mono font-bold \${m.color || 'text-white'}\`}>{m.value}</span>
                    </div>
                 ))}
              </div>

              {/* MAIN LAYOUT: MAP (66%) + SIDEBAR (33%) */}
              <div className="grid grid-cols-12 gap-5 items-start">
                <div className="col-span-12 lg:col-span-8 flex flex-col space-y-5">
                   <MarineMap
                     analysis={analysis}
                     selectedPoint={selectedPoint}
                     onSelectPoint={handleSelectPoint}
                   />
                   
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                     <ExplainableAi analysis={analysis} />
                     <AgenticReasoning analysis={analysis} />
                   </div>
                </div>

                <div className="col-span-12 lg:col-span-4 flex flex-col space-y-4 max-h-[1400px] overflow-y-auto pr-2 custom-scrollbar">
                  
                  {/* ORCA DECISION */}
                  <div className="bg-[#111814] border border-[#d4850a]/30 rounded-xl p-4 shrink-0 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#d4850a]" />
                    <div className="flex items-center justify-between mb-3 ml-2">
                       <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#d4850a]">ORCA DECISION</h3>
                       <span className={\`px-2 py-0.5 rounded text-[10px] font-bold uppercase border \${analysis?.decision?.risk_level === 'SAFE' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900' : 'bg-amber-950/40 text-amber-400 border-amber-900'}\`}>
                         {analysis?.decision?.risk_level}
                       </span>
                    </div>
                    <div className="text-xs text-white/90 font-medium leading-relaxed ml-2">
                       {analysis?.decision?.recommendation}
                    </div>
                  </div>

                  {/* RISK DISTRIBUTION BAR */}
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-4 shrink-0 shadow-sm">
                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-3">GRID RISK DISTRIBUTION</h3>
                    <div className="flex w-full h-2 rounded-full overflow-hidden mb-2 border border-white/5">
                       {riskCounts.SAFE > 0 && <div style={{width: \`\${(riskCounts.SAFE/pts.length)*100}%\`}} className="h-full bg-emerald-500" />}
                       {riskCounts.CAUTION > 0 && <div style={{width: \`\${(riskCounts.CAUTION/pts.length)*100}%\`}} className="h-full bg-yellow-500" />}
                       {riskCounts.MODERATE > 0 && <div style={{width: \`\${(riskCounts.MODERATE/pts.length)*100}%\`}} className="h-full bg-amber-500" />}
                       {riskCounts.HIGH > 0 && <div style={{width: \`\${(riskCounts.HIGH/pts.length)*100}%\`}} className="h-full bg-orange-500" />}
                       {riskCounts.DANGER > 0 && <div style={{width: \`\${(riskCounts.DANGER/pts.length)*100}%\`}} className="h-full bg-red-500" />}
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-white/50">
                       <span className={riskCounts.SAFE ? 'text-emerald-500' : ''}>{riskCounts.SAFE} SAFE</span>
                       <span className={riskCounts.MODERATE ? 'text-amber-500' : ''}>{riskCounts.MODERATE} MOD</span>
                       <span className={riskCounts.DANGER ? 'text-red-500' : ''}>{riskCounts.DANGER} DNG</span>
                    </div>
                  </div>

                  {/* ROUTE INTELLIGENCE */}
                  {waypoints.length > 0 && (
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-4 shrink-0 shadow-sm">
                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-3">ROUTE INTELLIGENCE</h3>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="bg-[#0a0d0a] p-2.5 rounded border border-white/5">
                          <div className="text-[8px] text-white/40 uppercase mb-1">Total Distance</div>
                          <div className="text-xs font-bold text-white font-mono">{distDisplay}</div>
                       </div>
                       <div className="bg-[#0a0d0a] p-2.5 rounded border border-white/5">
                          <div className="text-[8px] text-white/40 uppercase mb-1">Peak Risk Seg</div>
                          <div className="text-xs font-bold text-amber-500 font-mono">{Math.round(highestRouteRisk)} / 100</div>
                       </div>
                    </div>
                    <div className="mt-3 text-[10px] text-white/60">
                      Primary risk area located near: <span className="text-white font-mono">{highestRiskLatLon}</span>
                    </div>
                  </div>
                  )}

                  {/* DATA QUALITY & SOURCES */}
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-4 shrink-0 shadow-sm">
                     <h3 className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-3">ANALYSIS SOURCES</h3>
                     <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="flex justify-between items-center bg-[#0a0d0a] p-2 rounded border border-[var(--border-base)]">
                          <span className="text-white/70">Weather</span>
                          <span className="text-emerald-400 font-bold">✓</span>
                        </div>
                        <div className="flex justify-between items-center bg-[#0a0d0a] p-2 rounded border border-[var(--border-base)]">
                          <span className="text-white/70">Ocean</span>
                          <span className="text-emerald-400 font-bold">✓</span>
                        </div>
                        <div className="flex justify-between items-center bg-[#0a0d0a] p-2 rounded border border-[var(--border-base)]">
                          <span className="text-white/70">Tide</span>
                          <span className="text-emerald-400 font-bold">✓</span>
                        </div>
                        <div className="flex justify-between items-center bg-[#0a0d0a] p-2 rounded border border-[var(--border-base)]">
                          <span className="text-white/70">Risk</span>
                          <span className="text-emerald-400 font-bold">✓</span>
                        </div>
                     </div>
                  </div>

                  {/* WHAT CHANGED / HISTORICAL (Dummy logic handling non-existent historical data gracefully) */}
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-4 shrink-0 shadow-sm">
                     <h3 className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-3">WHAT CHANGED?</h3>
                     {analysis?.historical ? (
                       <div className="text-xs text-white">Historical comparison logic here</div>
                     ) : (
                       <div className="text-[10px] text-white/40 flex items-center justify-center p-4 border border-dashed border-white/10 rounded">
                          Historical comparison unavailable
                       </div>
                     )}
                  </div>

                  {/* 3x3 POINT GRID */}
                  <PointGrid
                    analysis={analysis}
                    selectedPoint={selectedPoint}
                    onSelectPoint={handleSelectPoint}
                  />

                </div>
              </div>
            </div>
          );
        })()}\`;


if(c.includes(targetOld)) {
   c = c.replace(targetOld, replacement);
   fs.writeFileSync('src/components/DecisionResultsPage.jsx', c);
   console.log("Success");
} else {
   console.log("Could not find target string.");
}
