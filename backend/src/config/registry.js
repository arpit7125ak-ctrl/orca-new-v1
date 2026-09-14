// src/config/registry.js
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS:
// Sections 7.6, 7.7 and 7.8 all say the same thing: activities, vessel types
// and languages are CONFIGURATION-DRIVEN, not hard-coded. This module loads
// those lists once at startup from /shared-config and exposes fast lookups.
//
// "shared-config" is shared with the AI Service on purpose - both services
// must agree on what "fishing" or "ta" means. Neither service owns the list.
//
// Loading happens ONCE at require-time. If a config file is malformed the
// process dies immediately rather than serving requests with a half-loaded
// registry.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

// shared-config sits at the repo root, two levels above backend/src/config
const SHARED_CONFIG_DIR = path.resolve(__dirname, '../../../shared-config');

function loadJson(filename) {
  const filePath = path.join(SHARED_CONFIG_DIR, filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(
      `[registry] Could not load ${filename} from ${SHARED_CONFIG_DIR}: ${err.message}`
    );
  }
}

const activitiesFile = loadJson('activities.json');
const vesselTypesFile = loadJson('vessel-types.json');
const languagesFile = loadJson('languages.json');
const canonicalUnitsFile = loadJson('canonical-units.json');

// Build Sets/Maps once so validation is O(1) per request instead of scanning
// an array on every call.
const activityIds = new Set(activitiesFile.activities.map((a) => a.id));
const vesselTypeIds = new Set(vesselTypesFile.vessel_types.map((v) => v.id));
const languageCodes = new Set(languagesFile.languages.map((l) => l.code));

const vesselTypeById = new Map(vesselTypesFile.vessel_types.map((v) => [v.id, v]));
const activityById = new Map(activitiesFile.activities.map((a) => [a.id, a]));
const languageByCode = new Map(languagesFile.languages.map((l) => [l.code, l]));

const registry = Object.freeze({
  // ---- Raw lists (for GET endpoints that expose options to the Frontend) --
  activities: activitiesFile.activities,
  vesselTypes: vesselTypesFile.vessel_types,
  languages: languagesFile.languages,
  canonicalUnits: canonicalUnitsFile.units,

  // ---- Validation helpers (Section 7.6 / 7.7 / 7.8) ----------------------
  isValidActivity: (id) => activityIds.has(id),
  isValidVesselType: (id) => vesselTypeIds.has(id),
  isValidLanguage: (code) => languageCodes.has(code),

  // ---- Lookups -----------------------------------------------------------
  getActivity: (id) => activityById.get(id) || null,
  getVesselType: (id) => vesselTypeById.get(id) || null,
  getLanguage: (code) => languageByCode.get(code) || null,

  // Section 24.2: canonical unit for a parameter, or null if the parameter is
  // unknown. Callers MUST treat null as "cannot verify" - never as "any unit
  // is fine".
  getCanonicalUnit: (parameter) => canonicalUnitsFile.units[parameter] || null,

  // ---- Sorted valid-value lists for error messages ------------------------
  // Section 7.6: "An unknown activity value returns 400." A 400 is far more
  // useful when it tells the caller what the accepted values actually are.
  validActivityIds: () => [...activityIds].sort(),
  validVesselTypeIds: () => [...vesselTypeIds].sort(),
  validLanguageCodes: () => [...languageCodes].sort(),
});

console.log(
  `[registry] Loaded ${registry.activities.length} activities, ` +
  `${registry.vesselTypes.length} vessel types, ` +
  `${registry.languages.length} languages, ` +
  `${Object.keys(registry.canonicalUnits).length} canonical units`
);

module.exports = registry;
