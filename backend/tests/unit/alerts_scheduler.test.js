/**
 * tests/unit/alerts_scheduler.test.js
 *
 * Unit tests for proactive alert scheduler and structured alert inference:
 * 1. Structured alert type inference (no free text keywords).
 * 2. Scheduler boot & lifecycle (start / stop).
 * 3. Delivery skipped/failed when VAPID keys are absent.
 */

const scheduler = require('../../src/modules/alerts/scheduler');
const webPush = require('../../src/modules/alerts/delivery/webPush');
const AlertEvent = require('../../src/db/models/alertEvent.model');

describe('Alert Scheduler & Structured Alert Inference', () => {
  test('inferAlertType correctly identifies high_wave from structured risk factors', () => {
    const analysis = { agent_statuses: { ocean: 'completed', weather: 'completed' } };
    const decision = { key_findings: [], one_line_recommendation: 'Caution' };
    const riskResult = {
      results: [
        {
          point_id: 'P1',
          risk_level: 'CAUTION',
          risk_factors: ['wave_height_m', 'swell_height_m'],
          hard_rules_applied: [{ rule_id: 'high_wave_rough_sea', floor_score: 55 }],
        },
      ],
    };

    const alertType = scheduler.inferAlertType(analysis, decision, riskResult);
    expect(alertType).toBe('high_wave');
  });

  test('inferAlertType correctly identifies cyclone from structured official warnings', () => {
    const analysis = { agent_statuses: {} };
    const decision = { key_findings: [] };
    const riskResult = {
      results: [
        {
          point_id: 'P1',
          risk_level: 'DANGEROUS',
          official_warnings: [
            {
              warning_type: 'cyclone',
              bulletin_id: 'IMD-CYCLONE-BOB-01',
              issuing_authority: 'India Meteorological Department',
            },
          ],
        },
      ],
    };

    const alertType = scheduler.inferAlertType(analysis, decision, riskResult);
    expect(alertType).toBe('cyclone');
  });

  test('inferAlertType maps wind conditions to strong_wind', () => {
    const analysis = { agent_statuses: {} };
    const decision = { key_findings: [] };
    const riskResult = {
      results: [
        {
          point_id: 'P1',
          risk_level: 'CAUTION',
          risk_factors: ['wind_speed_ms', 'wind_gust_ms'],
        },
      ],
    };

    const alertType = scheduler.inferAlertType(analysis, decision, riskResult);
    expect(alertType).toBe('strong_wind');
  });

  test('inferAlertType defaults to other_hazard for general unclassified conditions', () => {
    const analysis = { agent_statuses: {} };
    const decision = { key_findings: [] };
    const riskResult = {
      results: [
        {
          point_id: 'P1',
          risk_level: 'CAUTION',
          risk_factors: ['sea_surface_temperature'],
        },
      ],
    };

    const alertType = scheduler.inferAlertType(analysis, decision, riskResult);
    expect(alertType).toBe('other_hazard');
  });

  test('doc.validate() succeeds on AlertEvent with inferred alert types', async () => {
    const validTypes = ['high_wave', 'strong_wind', 'cyclone', 'other_hazard'];
    for (const at of validTypes) {
      const doc = new AlertEvent({
        subscription_id: 'sub_test_123',
        analysis_id: 'req_test_123',
        alert_type: at,
        level: 'CAUTION',
        message_text: `Test advisory for ${at}`,
        channel: 'web_push',
        dedup_key: `dedup_${at}_123`,
        status: 'evaluated_no_send',
      });
      await expect(doc.validate()).resolves.toBeUndefined();
    }
  });

  test('Scheduler lifecycle: start and stop cleanly', () => {
    expect(() => {
      scheduler.start();
      scheduler.stop();
    }).not.toThrow();
  });

  test('Web Push delivery fails/skips honestly when VAPID keys absent', async () => {
    const res = await webPush.send(null, { title: 'Test Alert', body: 'Warning' });
    expect(res.delivered).toBe(false);
    expect(['not_configured', 'no_push_subscription']).toContain(res.reason);
  });
});
