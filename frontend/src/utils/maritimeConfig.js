// orca/frontend/src/utils/maritimeConfig.js
// Synchronized with shared-config/activities.json and shared-config/vessel-types.json

export const ACTIVITIES = [
  { id: 'fishing', label: '🎣 Coastal / Offshore Fishing' },
  { id: 'boating', label: '⛵ Boating & Coastal Navigation' },
  { id: 'marine_research', label: '🔬 Oceanographic & Marine Research' },
  { id: 'diving', label: '🤿 Diving & Underwater Operations' },
  { id: 'surfing', label: '🏄 Surfing & Water Sports' },
  { id: 'tourism', label: '🚤 Coastal Tourism & Ferry' },
  { id: 'shipping', label: '📦 Commercial Shipping & Cargo' },
];

export const VESSEL_TYPES = [
  { id: 'motorized_country_craft', label: '🚤 Motorized Country Craft (FRP <10m)' },
  { id: 'mechanized_fishing_vessel', label: '🚢 Mechanized Fishing Vessel (Trawler >15m)' },
  { id: 'traditional_non_motorized', label: '🛶 Traditional Non-Motorized Canoe' },
  { id: 'recreational_boat', label: '🛥️ Speedboat / Recreational Boat' },
  { id: 'research_vessel', label: '🔬 Marine Research Vessel' },
  { id: 'large_commercial_vessel', label: '🚢 Large Commercial Vessel / Cargo' },
];

const ACTIVITY_ALIASES = {
  research: 'marine_research',
  'marine research': 'marine_research',
  oceanographic: 'marine_research',
  trawling: 'fishing',
  recreation: 'boating',
  'water sports': 'surfing',
  cargo: 'shipping',
};

const VESSEL_ALIASES = {
  trawler: 'mechanized_fishing_vessel',
  cargo_coaster: 'large_commercial_vessel',
  passenger_ferry: 'recreational_boat',
  speedboat: 'recreational_boat',
};

export function normalizeActivity(val) {
  if (!val) return undefined;
  const clean = String(val).toLowerCase().trim();
  if (!clean) return undefined;
  return ACTIVITY_ALIASES[clean] || clean;
}

export function normalizeVesselType(val) {
  if (!val) return undefined;
  const clean = String(val).toLowerCase().trim();
  if (!clean) return undefined;
  return VESSEL_ALIASES[clean] || clean;
}
