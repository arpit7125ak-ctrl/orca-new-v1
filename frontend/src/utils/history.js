/**
 * LocalStorage Advisory & Mission History Manager
 * Keeps track of real user analyses (point, route, trend, chat) without fabricating data.
 * Architecture Spec §11 & §103. Max 50 items.
 */

const STORAGE_KEY = 'ORCA_ADVISORY_HISTORY';
const MAX_ENTRIES = 50;

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
 * Add a new history item.
 * @param {Object} entry
 * @param {string} entry.analysis_id
 * @param {'point'|'route'|'trend'|'chat'} entry.kind
 * @param {string} [entry.title]
 * @param {string} [entry.place]
 * @param {string} [entry.created_at]
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
