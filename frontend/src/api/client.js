/**
 * ORCA API Client
 * Connects Frontend strictly to the Backend Public Gateway (Port 4000)
 * Architecture Spec §2.1.4: Frontend NEVER communicates directly with AI-Service or external providers.
 */

import { normalizeActivity, normalizeVesselType } from '../utils/maritimeConfig';

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
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
  /**
   * Health check on backend
   */
  async checkHealth() {
    try {
      const res = await fetch('/health');
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
   * Get the most recently completed real analysis
   */
  async getLatestAnalysis() {
    const res = await request('/analysis/latest');
    return res.data || res;
  },

  /**
   * Poll analysis until completion or failure
   */
  async pollAnalysisUntilDone(analysisId, onProgress = () => { }, intervalMs = 1200, maxAttempts = 50) {
    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts++;
      const statusData = await this.getAnalysisStatus(analysisId);
      onProgress(statusData);

      if (statusData.status === 'completed' || statusData.status === 'partial') {
        return await this.getAnalysis(analysisId);
      }
      if (statusData.status === 'failed') {
        throw new Error(statusData.error || 'Analysis failed in pipeline processing');
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error('Analysis polling timed out after 60 seconds');
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
   * Delete alert subscription
   */
  async deleteAlertSubscription(id) {
    const res = await request(`/alerts/subscriptions/${id}`, {
      method: 'DELETE',
    });
    return res.data || res;
  },
};
