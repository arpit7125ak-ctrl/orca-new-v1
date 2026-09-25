/**
 * ============================================================================
 * ORCA GIS & Marine Layer Explorer (src/components/GisExplorer.jsx)
 * ============================================================================
 * Geospatial data catalog and layer registry (Page 6).
 * 
 * Capabilities (Architecture Spec §10, §60):
 * 1. Live Layer Directory: Queries /api/v1/map/layers to discover all available spatial rasters,
 *    polygon vectors, and constraint boundaries.
 * 2. 4 Domain Categories:
 *    - Physical Oceanography (Wave models, SST, currents, salinity)
 *    - Meteorology (IMD wind fields, gusts, atmospheric pressure, visibility)
 *    - Marine Hazards (Storm surges, cyclone tracks, high-wave warnings)
 *    - Boundaries & Navigation (EEZ, MPAs, 12 NM territorial limits, ports)
 * 3. Search & Metadata Filters: Real-time keyword filter by layer name, source agency, and geometry.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Database, Search, CheckCircle, RefreshCw } from 'lucide-react';
import { orcaApi } from '../api/client';

/**
 * Filter categories mapped to translation keys.
 */
const CATEGORIES = [
  { id: 'all', labelKey: 'gis.catAll', defaultLabel: 'All Cataloged Layers' },
  { id: 'oceanography', labelKey: 'gis.catOceanography', defaultLabel: 'Physical Oceanography' },
  { id: 'meteorology', labelKey: 'gis.catMeteorology', defaultLabel: 'Meteorology' },
  { id: 'hazards', labelKey: 'gis.catHazards', defaultLabel: 'Marine Hazards' },
  { id: 'boundaries', labelKey: 'gis.catBoundaries', defaultLabel: 'Boundaries & Navigation' },
];

/**
 * GIS Layer Explorer Component.
 */
export default function GisExplorer() {
  const { t } = useTranslation('ui');
  const [layers, setLayers] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLayers() {
      setLoading(true);
      try {
        const data = await orcaApi.getMapLayers();
        if (data && Array.isArray(data.layers) && data.layers.length > 0) {
          const mapped = data.layers.map((l, i) => {
            const type = (l.layer_type || '').toLowerCase();
            let category = 'oceanography';
            if (type.includes('zone') || type.includes('sea') || type.includes('boundary') || type.includes('park') || type.includes('port')) {
              category = 'boundaries';
            } else if (type.includes('wind') || type.includes('temp') || type.includes('precip') || type.includes('gust') || type.includes('visibility')) {
              category = 'meteorology';
            } else if (type.includes('surge') || type.includes('warning') || type.includes('tsunami') || type.includes('hazard') || type.includes('cyclone')) {
              category = 'hazards';
            }

            return {
              id: l.layer_type || `layer_${i}`,
              name: l.layer_name || `Marine Layer ${i + 1}`,
              category,
              source: l.source || 'INCOIS / IMD Marine Gateway',
              res: l.geometry?.type ? `${l.geometry.type} Vector` : 'Spatial Raster 0.05°',
              cadence: l.constraint_type === 'hard_exclusion' ? 'Strict Hard Exclusion' : l.constraint_type === 'warning_only' ? 'Advisory Warning' : 'Active Real-Time',
              status: l.properties?.demo_only ? 'Active Seed Layer' : 'Operational Feed',
            };
          });
          setLayers(mapped);
        }
      } catch (err) {
        console.warn('Failed to fetch layers from backend:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLayers();
  }, []);



  const filtered = layers.filter((l) => {
    const matchCat = filterCategory === 'all' || l.category === filterCategory;
    const matchSearch =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Layers className="w-6 h-6 text-[var(--accent-primary)]" />
              <h2 className="text-lg sm:text-xl font-black text-[var(--text-primary)]">
                {t('gis.explorerTitle', { defaultValue: 'Live GIS Oceanographic & Marine Hazard Layers' })}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              {t('gis.explorerSubtitle', { defaultValue: 'Active geospatial catalogs ingested from INCOIS, IMD, GEBCO, and Marine Regions' })}
            </p>
          </div>
          <div className="flex items-center space-x-2 font-mono text-xs text-[var(--accent-primary)] bg-[var(--accent-dim)] px-3 py-1.5 rounded-lg border border-[var(--accent-primary)]">
            <Database className="w-3.5 h-3.5" />
            <span>{t('gis.activeInDb', { count: layers.length, defaultValue: '{{count}} Active in Database' })}</span>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="mt-5 pt-4 border-t border-[var(--border-base)] flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex overflow-x-auto space-x-2 w-full md:w-auto scrollbar-none">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilterCategory(c.id)}
                className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                  filterCategory === c.id
                    ? 'bg-[var(--accent-primary)] text-black font-bold shadow-md'
                    : 'bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t(c.labelKey, { defaultValue: c.defaultLabel })}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('gis.searchPlaceholder', { defaultValue: 'Search layer name or agency...' })}
              className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border-base)] rounded-lg text-xs text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Layer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((layer) => (
          <div
            key={layer.id}
            className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-4 hover:border-slate-700 transition-all space-y-2.5"
          >
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] uppercase font-bold text-[var(--accent-primary)] bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                {layer.id}
              </span>
              <span className="flex items-center space-x-1 text-[10px] font-semibold text-[var(--safe-bright)] bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                <CheckCircle className="w-2.5 h-2.5" />
                <span>{layer.status}</span>
              </span>
            </div>

            <h4 className="text-sm font-bold text-[var(--text-primary)] leading-snug">{layer.name}</h4>

            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[var(--border-base)] text-[11px] text-[var(--text-secondary)]">
              <div>
                <span className="text-[var(--text-muted)] block text-[9px] uppercase font-semibold">{t('gis.sourceAgency', { defaultValue: 'Source Agency' })}</span>
                <span className="text-[var(--text-primary)] font-medium truncate block">{layer.source}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[9px] uppercase font-semibold">{t('gis.geometryType', { defaultValue: 'Geometry Type' })}</span>
                <span className="text-[var(--text-primary)] font-medium truncate block">{layer.res}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[9px] uppercase font-semibold">{t('gis.safetyDirectives', { defaultValue: 'Safety Directives' })}</span>
                <span className="text-[var(--text-primary)] font-medium truncate block">{layer.cadence}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[9px] uppercase font-semibold">{t('gis.domainDimension', { defaultValue: 'Domain Dimension' })}</span>
                <span className="text-[var(--accent-primary)] font-medium capitalize truncate block">{layer.category}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
