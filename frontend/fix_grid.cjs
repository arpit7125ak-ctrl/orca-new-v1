const fs = require('fs');

let c = fs.readFileSync('src/components/PointGrid.jsx', 'utf8');

const targetOld = \`  const points = rawPoints.map((p, idx) => {
    const pRisk = p.risk || {};
    const factors = Array.isArray(pRisk.risk_factors) ? pRisk.risk_factors : [];
    const formattedFactors = factors.map((f) => String(f).replace(/_/g, ' ')).join(', ');
    const finding = (Array.isArray(pRisk.key_findings) ? pRisk.key_findings[0] : null) || pRisk.reasoning || t('results.evaluated');
    const isPreferred = analysis?.decision?.preferred_point === (p.point_id || \\\`P\${idx}\\\`);
    const isWorst = analysis?.decision?.worst_point === (p.point_id || \\\`P\${idx}\\\`);

    const meas = p.measurements || {};
    const waveVal = meas.wave_height_m?.value != null ? \\\`\${meas.wave_height_m.value}m\\\` : null;
    const windVal = meas.wind_speed_ms?.value != null ? \\\`\${meas.wind_speed_ms.value}m/s\\\` : null;

    return {
      point_id: p.point_id || \\\`P\${idx}\\\`,
      lat: p.lat,
      lon: p.lon,
      risk_score: pRisk.final_score ?? null,
      status: pRisk.risk_level || 'UNRATED',
      dominant_hazard: formattedFactors || t('grid.noneReported'),
      finding,
      isPreferred,
      isWorst,
      official_warning: pRisk.official_warnings?.[0] || null,
      point_status: p.point_status || null,
      waveVal,
      windVal,
      rawPoint: p,
    };
  });\`;

const targetNew = \`  const [sortMode, setSortMode] = React.useState('default');
  
  const pointsData = rawPoints.map((p, idx) => {
    const pRisk = p.risk || {};
    const factors = Array.isArray(pRisk.risk_factors) ? pRisk.risk_factors : [];
    const formattedFactors = factors.map((f) => String(f).replace(/_/g, ' ')).join(', ');
    const finding = (Array.isArray(pRisk.key_findings) ? pRisk.key_findings[0] : null) || pRisk.reasoning || t('results.evaluated');
    const isPreferred = analysis?.decision?.preferred_point === (p.point_id || \\\`P\${idx}\\\`);
    const isWorst = analysis?.decision?.worst_point === (p.point_id || \\\`P\${idx}\\\`);

    const meas = p.measurements || {};
    const waveRaw = meas.wave_height_m?.value || 0;
    const windRaw = meas.wind_speed_ms?.value || 0;
    const visRaw = meas.visibility_km?.value || 0;

    const waveVal = meas.wave_height_m?.value != null ? \\\`\${meas.wave_height_m.value}m\\\` : null;
    const windVal = meas.wind_speed_ms?.value != null ? \\\`\${meas.wind_speed_ms.value}m/s\\\` : null;

    return {
      point_id: p.point_id || \\\`P\${idx}\\\`,
      lat: p.lat,
      lon: p.lon,
      risk_score: pRisk.final_score ?? null,
      status: pRisk.risk_level || 'UNRATED',
      dominant_hazard: formattedFactors || t('grid.noneReported'),
      finding,
      isPreferred,
      isWorst,
      official_warning: pRisk.official_warnings?.[0] || null,
      point_status: p.point_status || null,
      waveVal,
      windVal,
      waveRaw,
      windRaw,
      visRaw,
      rawPoint: p,
    };
  });

  const points = [...pointsData].sort((a, b) => {
    if (sortMode === 'risk') return (b.risk_score || 0) - (a.risk_score || 0);
    if (sortMode === 'wave') return b.waveRaw - a.waveRaw;
    if (sortMode === 'wind') return b.windRaw - a.windRaw;
    if (sortMode === 'visibility') return a.visRaw - b.visRaw; // lower is worse for visibility
    return 0; // default order
  });\`;


// Replace the Header part to include Sort Dropdown
const headerOld = \`      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] flex items-center space-x-2">
            <Compass className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>{t('grid.title')}</span>
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {t('grid.subtitle')}
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-[var(--accent-primary)] bg-[var(--accent-dim)] px-2.5 py-1 rounded-lg border border-[var(--accent-primary)]">
          {t('grid.evaluatedCount', { count: points.length })}
        </span>
      </div>\`;

const headerNew = \`      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] flex items-center space-x-2">
            <Compass className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>{t('grid.title')}</span>
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {t('grid.subtitle')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select 
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border-base)] rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wider outline-none cursor-pointer hover:border-white/20 transition"
          >
             <option value="default">Default Sort</option>
             <option value="risk">Sort by Risk</option>
             <option value="wave">Sort by Wave</option>
             <option value="wind">Sort by Wind</option>
             <option value="visibility">Sort by Vis</option>
          </select>
          <span className="text-xs font-mono font-bold text-[var(--accent-primary)] bg-[var(--accent-dim)] px-2.5 py-1 rounded-lg border border-[var(--accent-primary)]">
            {t('grid.evaluatedCount', { count: points.length })}
          </span>
        </div>
      </div>\`;

c = c.replace(targetOld, targetNew);
c = c.replace(headerOld, headerNew);
fs.writeFileSync('src/components/PointGrid.jsx', c);
