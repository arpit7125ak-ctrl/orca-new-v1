/**
 * ============================================================================
 * ORCA Client-Side Mission & Advisory History (src/utils/history.js)
 * ============================================================================
 * Manages persistent client-side browsing and mission history for:
 * - Single point & grid safety advisories ('point')
 * - Nautical passage planning results ('route')
 * - Ocean climate and SST trend analyses ('trend')
 * - Maritime conversational agent threads ('chat')
 * 
 * Architectural Compliance (Architecture Spec §11 & §103):
 * - Persists strictly to browser localStorage under key 'ORCA_ADVISORY_HISTORY'.
 * - Enforces FIFO capacity limit of 50 entries with deduplication on analysis_id.
 * - NEVER fabricates mock entries; only real completed server evaluations are recorded.
 */

const STORAGE_KEY = 'ORCA_ADVISORY_HISTORY';
const MAX_ENTRIES = 50;

/**
 * Safely resolves the active Web Storage implementation.
 * Compatible with standard browser window.localStorage and headless/SSR environments.
 * 
 * @returns {Storage|null} Active localStorage instance or null.
 */
function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

/**
 * Prepends a new completed analysis into persistent client history.
 * Automatically deduplicates matching analysis_id and truncates beyond MAX_ENTRIES (50).
 * 
 * @param {Object} entry - History entry record.
 * @param {string} entry.analysis_id - Unique server execution ID (e.g. req_20260924_...).
 * @param {'point'|'route'|'trend'|'chat'} [entry.kind='point'] - Category of analysis.
 * @param {string} [entry.title] - Descriptive mission or place title.
 * @param {string} [entry.place] - Human-readable geographical sector.
 * @param {string} [entry.created_at] - ISO 8601 creation timestamp.
 * @returns {Object|null} Stored entry object or null if analysis_id missing.
 */
export function addEntry({ analysis_id, kind = 'point', title = '', place = '', created_at = null }) {
  if (!analysis_id) return null;

  const storage = getStorage();
  const currentList = list();

  const newEntry = {
    analysis_id,
    kind,
    title: title || (kind === 'route' ? 'Nautical Passage' : kind === 'trend' ? 'Ocean Trend Series' : 'Coastal Advisory'),
    place: place || 'Coastal Sector',
    created_at: created_at || new Date().toISOString(),
  };

  // Prepend and filter out existing duplicate
  const updated = [newEntry, ...currentList.filter((item) => item.analysis_id !== analysis_id)].slice(0, MAX_ENTRIES);

  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save history entry:', e);
    }
  }

  return newEntry;
}

/**
 * List all saved history entries.
 * @returns {Array<Object>}
 */
export function list() {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Remove a specific history entry by analysis_id.
 * @param {string} id
 */
export function remove(id) {
  if (!id) return;
  const storage = getStorage();
  const currentList = list();
  const updated = currentList.filter((item) => item.analysis_id !== id);

  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not remove history entry:', e);
    }
  }
  return updated;
}

/**
 * Clear all history entries.
 */
export function clear() {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Could not clear history:', e);
    }
  }
  return [];
}

/**
 * Get the most recent analysis_id, if any.
 * @returns {string|null}
 */
export function lastId() {
  const items = list();
  return items.length > 0 ? items[0].analysis_id : null;
}
