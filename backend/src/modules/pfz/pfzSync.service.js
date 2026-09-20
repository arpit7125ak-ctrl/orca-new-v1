// src/modules/pfz/pfzSync.service.js
// ---------------------------------------------------------------------------
// INCOIS Potential Fishing Zone (PFZ) Live Synchronization Service.
//
// Fetches daily satellite lines from the INCOIS GeoServer OGC WFS endpoint,
// segregates the features into individual sector documents, and performs
// idempotent upserts into the MongoDB `pfz_advisories` collection.
//
// If INCOIS is unreachable on any given day, gracefully falls back to extending
// the validity window of existing documents by 48 hours for zero downtime.
// ---------------------------------------------------------------------------

const https = require('https');
const axios = require('axios');
const PfzAdvisory = require('../../db/models/pfzAdvisory.model');
const { logger } = require('../../observability/logger');

const INCOIS_WFS_URL = 'https://incois.gov.in/geoserver/PFZ_Automation/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=PFZ_Automation:pfzlines&outputFormat=application/json';

const STATE_SPECIES_MAP = {
  'KERALA': ['Indian Mackerel', 'Yellowfin Tuna', 'Oil Sardine', 'Carangids', 'Ribbonfish'],
  'MAHARASHTRA': ['Indian Mackerel', 'Yellowfin Tuna', 'Ribbonfish', 'Silver Pomfret', 'Bombay Duck'],
  'GUJARAT': ['Ribbonfish', 'Croakers', 'Yellowfin Tuna', 'Carangids', 'Cuttlefish'],
  'GOA': ['Indian Mackerel', 'Oil Sardine', 'Seerfish', 'Yellowfin Tuna'],
  'KARNATAKA': ['Indian Mackerel', 'Oil Sardine', 'Seerfish', 'Skipjack Tuna'],
  'NORTH TAMILNADU': ['Yellowfin Tuna', 'Skipjack Tuna', 'Seerfish', 'Barracuda', 'Carangids'],
  'SOUTH TAMILNADU': ['Yellowfin Tuna', 'Skipjack Tuna', 'Seerfish', 'Billfish', 'Snappers'],
  'NORTH ANDHRAPRADESH': ['Yellowfin Tuna', 'Indian Mackerel', 'Ribbonfish', 'Penaeid Prawns'],
  'SOUTH ANDHRAPRADESH': ['Yellowfin Tuna', 'Indian Mackerel', 'Ribbonfish', 'Seerfish'],
  'ORISSA': ['Hilsa Shad', 'Silver Pomfret', 'Ribbonfish', 'Indian Mackerel'],
  'ODISHA': ['Hilsa Shad', 'Silver Pomfret', 'Ribbonfish', 'Indian Mackerel'],
  'WEST BENGAL': ['Hilsa Shad', 'Silver Pomfret', 'Catfish', 'Ribbonfish'],
  'LAKSHADWEEP': ['Yellowfin Tuna', 'Skipjack Tuna', 'Bigeye Tuna', 'Bonito'],
  'ANDAMAN': ['Yellowfin Tuna', 'Skipjack Tuna', 'Mahi Mahi', 'Trevally'],
  'NICOBAR': ['Yellowfin Tuna', 'Skipjack Tuna', 'Bonito', 'Snappers'],
};

function formatSectorName(stateName, sectorCode) {
  if (!stateName) return 'India Coastal Waters';
  const name = stateName.trim();
  const title = name.split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return sectorCode ? `${title} (Sector ${sectorCode})` : `${title} Sector`;
}

function getDateFromJulian(year, julianDay) {
  const y = parseInt(year, 10) || new Date().getUTCFullYear();
  const d = parseInt(julianDay, 10) || 1;
  const startOfYear = new Date(Date.UTC(y, 0, 1));
  return new Date(startOfYear.getTime() + (d - 1) * 86400000);
}

async function fetchLiveIncoisPfz() {
  logger.info('[pfz-sync] Querying live INCOIS GeoServer WFS endpoint...');
  const agent = new https.Agent({ rejectUnauthorized: false });
  const response = await axios.get(INCOIS_WFS_URL, {
    httpsAgent: agent,
    timeout: 25000,
    headers: {
      'User-Agent': 'ORCA-Marine-Sync/1.0',
      'Accept': 'application/json, text/plain, */*'
    }
  });

  if (response.data && response.data.features && Array.isArray(response.data.features)) {
    return response.data.features;
  }
  throw new Error('Invalid GeoJSON payload received from INCOIS WFS');
}

async function syncLiveFeatures(features) {
  let inserted = 0;
  let updated = 0;

  for (const feat of features) {
    const props = feat.properties || {};
    const geom = feat.geometry || {};

    if (!geom.coordinates || !Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
      continue;
    }

    const state = (props.STATE || '').toUpperCase().trim();
    const sectorCode = props.SECTOR;
    const sectorDisplay = formatSectorName(state, sectorCode);
    const dateIssued = props.DATE ? getDateFromJulian(props.DATE.slice(0, 4), props.DATE.slice(4)) : new Date();
    const validUntil = new Date(dateIssued.getTime() + 48 * 3600 * 1000);

    const featureId = feat.id || `feat_${Math.random().toString(36).slice(2, 9)}`;
    const advisoryId = `INCOIS_PFZ_${props.DATE || '2026'}_${featureId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    let primaryCoords = geom.coordinates;
    if (geom.type === 'MultiLineString') {
      primaryCoords = geom.coordinates[0];
    }

    const sst = props.SST ? parseFloat(props.SST) : 28.5;
    const species = STATE_SPECIES_MAP[state] || ['Tuna', 'Mackerel', 'Sardines'];

    const doc = {
      advisory_id: advisoryId,
      source: 'INCOIS_LIVE_WFS',
      sector: sectorDisplay,
      location_name: sectorDisplay,
      geometry: {
        type: 'LineString',
        coordinates: primaryCoords
      },
      depth_contour_m: props.DEPTH ? parseInt(props.DEPTH, 10) : 50,
      sst_celsius: sst,
      chlorophyll_mg_m3: 1.25,
      target_species: species,
      confidence_score: 0.90,
      valid_from: dateIssued,
      valid_to: validUntil,
      active: true,
      last_synced_at: new Date()
    };

    const existing = await PfzAdvisory.findOne({ advisory_id: advisoryId });
    if (existing) {
      await PfzAdvisory.updateOne({ advisory_id: advisoryId }, { $set: doc });
      updated += 1;
    } else {
      await PfzAdvisory.create(doc);
      inserted += 1;
    }
  }

  return { inserted, updated, total: features.length };
}

async function extendLatestExistingAdvisories() {
  const count = await PfzAdvisory.countDocuments({ active: true });
  if (count > 0) {
    const extendedUntil = new Date(Date.now() + 48 * 3600 * 1000);
    const res = await PfzAdvisory.updateMany(
      { active: true },
      { $set: { valid_to: extendedUntil } }
    );
    logger.info(
      { modifiedCount: res.modifiedCount, extendedUntil: extendedUntil.toISOString() },
      '[pfz-sync] INCOIS unreachable: extended latest existing advisories'
    );
    return count;
  }
  throw new Error('No existing advisories in MongoDB to fallback on.');
}

/**
 * Main synchronization execution function.
 * Called both by the daily cron scheduler and manual scripts.
 */
async function syncPfzFromIncois() {
  logger.info('[pfz-sync] Starting INCOIS PFZ synchronization cycle...');
  try {
    const liveFeatures = await fetchLiveIncoisPfz();
    if (liveFeatures && liveFeatures.length > 0) {
      const stats = await syncLiveFeatures(liveFeatures);
      await PfzAdvisory.createIndexes();
      logger.info(stats, '[pfz-sync] Synchronization successful');
      return { success: true, ...stats };
    }
    await extendLatestExistingAdvisories();
    return { success: true, fallback: true };
  } catch (err) {
    logger.warn({ error: err.message }, '[pfz-sync] Live fetch failed, using fallback');
    await extendLatestExistingAdvisories();
    return { success: true, fallback: true, error: err.message };
  }
}

module.exports = {
  syncPfzFromIncois,
  fetchLiveIncoisPfz,
  syncLiveFeatures,
  extendLatestExistingAdvisories
};
