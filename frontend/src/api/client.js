/**
 * ============================================================================
 * ORCA API Client (src/api/client.js)
 * ============================================================================
 * Central HTTP client connecting the React frontend strictly to the Node.js
 * Backend Gateway (Default Port 4000).
 * 
 * Architectural Compliance (Architecture Spec §2.1.4):
 * - Frontend NEVER communicates directly with Python AI-Service (Port 8000) or
 *   external data sources (INCOIS, IMD, Copernicus).
 * - All requests flow through this client to `/api/v1/*` on the backend gateway.
 * - Handles base URL resolution, runtime URL overrides (via localStorage),
 *   unified JSON headers, detailed violation parsing, and standardized error logging.
 */

import { normalizeActivity, normalizeVesselType } from '../utils/maritimeConfig';

/**
 * Resolves the active base URL for API requests.
 * 
 * Resolution Priority:
 * 1. window.localStorage 'ORCA_API_BASE' (for local testing/staging override).
 * 2. Vite environment variable: VITE_API_BASE or VITE_API_BASE_URL.
 * 3. Render deployment auto-detection (*.onrender.com).
 * 4. Fallback default relative path '/api/v1'.
 * 
 * @returns {string} Clean base URL without trailing slashes.
 */
export function getApiBase() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem('ORCA_API_BASE');
    if (saved) return saved.replace(/\/+$/, '');
  }
  const envBase = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, '');

  // Auto-detection for Render deployments
  if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
    return 'https://orca-backend-anp5.onrender.com/api/v1';
  }

  return '/api/v1';
}

/**
 * Manually updates or clears the localStorage API base URL override.
 * 
 * @param {string|null} newUrl - New base URL to persist, or empty/null to remove override.
 */
export function setApiBase(newUrl) {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (newUrl && newUrl.trim()) {
      window.localStorage.setItem('ORCA_API_BASE', newUrl.trim().replace(/\/+$/, ''));
    } else {
      window.localStorage.removeItem('ORCA_API_BASE');
    }
  }
}

/**
 * Core generic fetch wrapper for all HTTP communications with the backend gateway.
 * 
 * Features:
 * - Automatically prepends current `getApiBase()` to relative endpoints.
 * - Enforces application/json Content-Type header.
 * - Extracts and formats detailed validation error violations from backend JSON schema responses.
 * - Standardized console error reporting with HTTP method and target URL.
 * 
 * @param {string} endpoint - API route (e.g. '/analysis' or '/health').
 * @param {RequestInit} [options={}] - Standard fetch configuration options.
 * @returns {Promise<any>} Parsed response data JSON.
 * @throws {Error} When response.ok is false or a network communication error occurs.
 */
async function request(endpoint, options = {}) {
  const base = getApiBase();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${base}${cleanEndpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      let errorMsg = (data && data.error && data.error.message) || (data && data.message) || `HTTP error ${response.status}`;
      if (data && data.error && data.error.details && Array.isArray(data.error.details.violations)) {
        const violationDetails = data.error.details.violations.map(v => `${v.field}: ${v.message}`).join(', ');
        errorMsg += ` (${violationDetails})`;
      }
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    console.error(`[ORCA API Error] ${options.method || 'GET'} ${url}:`, err);
    throw err;
  }
}

export const orcaApi = {
  getApiBase,
  setApiBase,

  /**
   * Health check on backend
   */
  async checkHealth() {
    try {
      const base = getApiBase();
      const healthUrl = `${base}/health`;
      const res = await fetch(healthUrl);
      return await res.json();
    } catch {
      return { status: 'offline' };
    }
  },

  /**
   * Fetch static configuration (activities, vessel types, units, languages)
   */
  async getConfig() {
    const res = await request('/config');
    return res.data || res;
  },

  /**
   * Submit new safety analysis query (natural language or structured)
   */
  async createAnalysis(payload) {
    const sanitized = { ...payload };
    if (sanitized.activity) {
      sanitized.activity = normalizeActivity(sanitized.activity);
      if (!sanitized.activity) delete sanitized.activity;
    } else {
      delete sanitized.activity;
    }

    if (sanitized.vessel_type) {
      sanitized.vessel_type = normalizeVesselType(sanitized.vessel_type);
      if (!sanitized.vessel_type) delete sanitized.vessel_type;
    } else {
      delete sanitized.vessel_type;
    }

    if (!sanitized.date) {
      delete sanitized.date;
    }
    if (!sanitized.time_range) {
      delete sanitized.time_range;
    }
    if (!sanitized.place_name || !sanitized.place_name.trim()) {
      delete sanitized.place_name;
    }

    const res = await request('/analysis', {
      method: 'POST',
      body: JSON.stringify(sanitized),
    });
    return res.data || res;
  },

  /**
   * Poll status of an ongoing analysis
   */
  async getAnalysisStatus(analysisId) {
    const res = await request(`/analysis/${analysisId}/status`);
    return res.data || res;
  },

  /**
   * Get full completed analysis results
   */
  async getAnalysis(analysisId) {
    const res = await request(`/analysis/${analysisId}`);
    return res.data || res;
  },

  /**
   * Poll analysis until completion or failure (defaults to 2s intervals, 300 attempts = 600s / 10 minutes)
   */
  async pollAnalysisUntilDone(analysisId, onProgress = () => { }, intervalMs = 2000, maxAttempts = 300) {
    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts++;
      const statusData = await this.getAnalysisStatus(analysisId);
      onProgress(statusData);

      if (statusData.status === 'completed' || statusData.status === 'partial') {
        return await this.getAnalysis(analysisId);
      }
      if (statusData.status === 'failed') {
        const errMsg = typeof statusData.error === 'string'
          ? statusData.error
          : statusData.error?.message || statusData.error_message || 'Analysis failed in pipeline processing';
        const err = new Error(errMsg);
        err.error_category = statusData.error?.error_category;
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    const totalSeconds = Math.round((maxAttempts * intervalMs) / 1000);
    throw new Error(`Analysis polling timed out after ${totalSeconds} seconds`);
  },

  /**
   * Check GPS geofence against marine protected zones, borders, and hazards
   */
  async checkGeofence(payload) {
    const res = await request('/geofence/check', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data || res;
  },

  /**
   * Send conversational multi-turn message to maritime AI assistant
   */
  async sendChatMessage(payload) {
    const res = await request('/chat/message', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data || res;
  },

  /**
   * Get conversational thread by conversation_id
   */
  async getConversation(conversationId) {
    const res = await request(`/chat/${conversationId}`);
    return res.data || res;
  },

  /**
   * Fetch GIS layers metadata and boundaries
   */
  async getMapLayers(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await request(`/map/layers${query ? `?${query}` : ''}`);
    return res.data || res;
  },

  /**
   * Fetch advisory report (markdown or json)
   */
  async getReport(analysisId, format = 'markdown') {
    const res = await request(`/report/${analysisId}?format=${format}`);
    return res.data || res;
  },

  /**
   * Plan route between origin and destination with risk analysis (§71)
   */
  async calculateRoute(payload) {
    const res = await request('/route', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data || res;
  },

  /**
   * Fetch route details by ID
   */
  async getRoute(routeId) {
    const res = await request(`/route/${routeId}`);
    return res.data || res;
  },

  /**
   * Submit trend analysis request (§72)
   */
  async createTrend(payload) {
    const res = await request('/trend', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data || res;
  },

  /**
   * Fetch trend analysis by ID
   */
  async getTrend(trendId) {
    const res = await request(`/trend/${trendId}`);
    return res.data || res;
  },

  /**
   * Create alert subscription (§70)
   */
  async createAlertSubscription(payload) {
    const res = await request('/alerts/subscriptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data || res;
  },

  /**
   * Fetch alert subscription by ID
   */
  async getAlertSubscription(id) {
    const res = await request(`/alerts/subscriptions/${id}`);
    return res.data || res;
  },

  /**
   * Fetch delivered/failed events for an alert subscription
   */
  async getSubscriptionEvents(id) {
    const res = await request(`/alerts/subscriptions/${id}/events`);
    return res.data || res;
  },

  /**
   * Delete alert subscription
   */
  async deleteAlertSubscription(id) {
    const res = await request(`/alerts/subscriptions/${id}`, {
      method: 'DELETE',
    });
    return res.data || res;
  },
};
